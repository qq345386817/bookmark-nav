import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SITE_ORIGIN, canonicalPath } from './seo-urls.mjs';

const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const urlNodes = `/*[local-name()='urlset' and namespace-uri()='${namespace}']/*[local-name()='url']`;
const xpath = (file, query) => execFileSync('xmllint', ['--nonet', '--xpath', query, file], { encoding: 'utf8' }).trim();

export function readSitemap(file) {
  execFileSync('xmllint', ['--nonet', '--noout', file], { stdio: 'pipe' });
  const count = Number(xpath(file, `count(${urlNodes})`));
  if (!count) throw new Error('Expected a nonempty sitemap urlset.');
  return Array.from({ length: count }, (_, index) => {
    const node = `${urlNodes}[${index + 1}]`;
    if (Number(xpath(file, `count(${node}/*[local-name()='loc'])`)) !== 1 || Number(xpath(file, `count(${node}/*[local-name()='lastmod'])`)) > 1) throw new Error('Each sitemap URL needs one loc and at most one lastmod.');
    return { url: xpath(file, `string(${node}/*[local-name()='loc'])`), lastmod: xpath(file, `string(${node}/*[local-name()='lastmod'])`) };
  });
}

export function pageFile(url) {
  const parsed = new URL(url);
  if (parsed.origin !== SITE_ORIGIN || parsed.search || parsed.hash || parsed.pathname !== canonicalPath(parsed.pathname) || path.posix.extname(parsed.pathname)) throw new Error(`Not a canonical HTML page: ${url}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const file = pathname.endsWith('/') ? pathname + 'index.html' : pathname + '.html';
  const relative = path.posix.normalize(file).slice(1);
  if (relative.includes('..') || pathname.includes('..')) throw new Error(`Unsafe page path: ${url}`);
  return relative;
}

export function pageModified(root, file) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing sitemap page: ${file}`);
  const timestamp = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: root, encoding: 'utf8' }).trim();
  if (!timestamp) throw new Error(`Commit the page before generating its lastmod: ${file}`);
  return timestamp;
}

export function renderSitemap(entries, now = Date.now()) {
  if (!entries.length || new Set(entries.map(entry => entry.url)).size !== entries.length) throw new Error('Sitemap URLs must be nonempty and unique.');
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<urlset xmlns="${namespace}">`, ...entries.map(({ url, lastmod }) => {
    pageFile(url);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(lastmod) || !Number.isFinite(Date.parse(lastmod)) || Date.parse(lastmod) > now) throw new Error(`Invalid or future lastmod for ${url}`);
    const [year, month, day] = lastmod.slice(0, 10).split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) throw new Error(`Invalid calendar date for ${url}`);
    return `  <url>\n    <loc>${escape(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  }), '</urlset>', ''].join('\n');
}

export function generatedSitemap(root) {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim();
  if (shallow === 'true') throw new Error('Full Git history is required for accurate lastmod. Fetch history before generating.');
  const entries = readSitemap(path.join(root, 'sitemap.xml'));
  return renderSitemap(entries.map(entry => ({ url: entry.url, lastmod: pageModified(root, pageFile(entry.url)) })));
}
