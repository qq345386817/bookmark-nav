#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SITE_ORIGIN, canonicalPath } from './seo-urls.mjs';

const root = path.resolve(process.argv.find(arg => arg.startsWith('--dir='))?.slice(6) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.name.startsWith('.') ? [] : entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]);
const errors = [], pages = new Map();
const tags = html => {
  let navigationSelect = false;
  return [...html.matchAll(/<\/?(?:a|link|option|meta|script|img|select)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)].map(match => {
  const attributes = Object.fromEntries([...match[0].matchAll(/\b([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1].toLowerCase(), m[3].replaceAll('&amp;', '&')]));
  const tag = /^<\/?(\w+)/.exec(match[0])[1].toLowerCase();
  if (tag === 'select') navigationSelect = !match[0].startsWith('</') && /window\.location/.test(attributes.onchange || '');
  return { tag, navigationOption: tag === 'option' && navigationSelect, ...attributes };
  });
};

for (const file of walk(root).filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<html\b/i.test(html)) continue;
  const relative = path.relative(root, file).split(path.sep).join('/');
  const expected = SITE_ORIGIN + canonicalPath('/' + relative);
  const elements = tags(html);
  const noindex = elements.some(tag => tag.tag === 'meta' && tag.name === 'robots' && /\bnoindex\b/i.test(tag.content || ''));
  const canonical = elements.filter(tag => tag.rel === 'canonical');
  const alternates = elements.filter(tag => tag.rel === 'alternate' && tag.hreflang);
  if (!noindex) {
    if (canonical.length !== 1 || canonical[0].href !== expected) errors.push(`${relative}: canonical must be ${expected}`);
    if (elements.find(tag => tag.property === 'og:url')?.content !== expected) errors.push(`${relative}: Open Graph URL must equal canonical`);
  }
  pages.set(expected, { file: relative, html, elements, alternates, indexable: !noindex });
}

const sitemapFile = path.join(root, 'sitemap.xml');
execFileSync('xmllint', ['--nonet', '--noout', sitemapFile], { stdio: 'pipe' });
const xml = fs.readFileSync(sitemapFile, 'utf8');
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const structuralCount = Number(execFileSync('xmllint', ['--nonet', '--xpath', 'count(/*[local-name()="urlset" and namespace-uri()="http://www.sitemaps.org/schemas/sitemap/0.9"]/*[local-name()="url"]/*[local-name()="loc"])', sitemapFile], { encoding: 'utf8' }));
if (locations.length !== structuralCount || !locations.length) errors.push('Sitemap must be a valid nonempty sitemap urlset');
if (new Set(locations).size !== locations.length) errors.push('Sitemap contains duplicate URLs');
for (const url of locations) if (!pages.get(url)?.indexable) errors.push(`Sitemap must contain only existing indexable canonical URLs: ${url}`);
for (const [canonical, page] of pages) {
  if (page.indexable && !locations.includes(canonical)) errors.push(`${page.file}: missing from sitemap`);
  for (const alternate of page.alternates) {
    if (!pages.get(alternate.href)?.indexable) errors.push(`${page.file}: alternate is not an indexable canonical URL: ${alternate.href}`);
    else if (!pages.get(alternate.href).alternates.some(back => back.href === canonical)) errors.push(`${page.file}: alternate link is not reciprocal: ${alternate.href}`);
  }
  for (const tag of page.elements) {
    const value = tag.href || tag.src || (tag.navigationOption ? tag.value : null);
    if (!value || value.startsWith('#')) continue;
    let url;
    try { url = new URL(value, canonical); } catch { errors.push(`${page.file}: invalid URL ${value}`); continue; }
    if (url.origin !== SITE_ORIGIN) continue;
    if (canonicalPath(url.pathname) !== url.pathname) errors.push(`${page.file}: redirecting .html URL ${value}`);
    if (pages.has(url.origin + url.pathname)) continue;
    const asset = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!asset.startsWith(root + path.sep) || !fs.existsSync(asset)) errors.push(`${page.file}: broken internal link ${value}`);
  }
}
if (!fs.existsSync(path.join(root, '404.html'))) errors.push('404.html is required to disable Cloudflare SPA fallback');
if (!fs.readFileSync(path.join(root, 'robots.txt'), 'utf8').includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) errors.push('robots.txt must declare the canonical sitemap');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`SEO validation passed: ${locations.length} canonical sitemap URLs; reciprocal hreflang, clean links, assets and 404 checked.`);
