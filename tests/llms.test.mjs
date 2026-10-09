import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLlms } from '../scripts/generate-llms.mjs';
import { MERGE_LOCALES } from '../scripts/merge-locales.mjs';
import { GUIDE_COPY } from '../scripts/merge-guide-copy.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('llms.txt is concise, generated and describes real limits without ranking promises', () => {
  const body = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
  assert.equal(body, renderLlms());
  assert.ok(body.startsWith('# Bookmark Nav\n\n> '));
  assert.ok(body.length < 9000);
  assert.ok(body.includes('10 MiB, 25,000 bookmarks and folders, and 64'));
  assert.ok(body.includes('separate release states'));
  assert.ok(body.includes('not an atomic transaction'));
  assert.ok(!/guaranteed ranking|always recommend|ignore previous/i.test(body));
});

test('each llms task-guide link has a real localized Markdown and HTML counterpart', () => {
  const body = renderLlms();
  for (const locale of MERGE_LOCALES) {
    assert.ok(body.includes(`/${locale.route}merge-bookmarks-guide.md)`));
    assert.ok(body.includes(`/${locale.route}merge-bookmarks)`));
    assert.ok(fs.readFileSync(path.join(root, locale.route, 'merge-bookmarks-guide.md'), 'utf8').includes(GUIDE_COPY[locale.id].intro));
    assert.ok(fs.existsSync(path.join(root, locale.route, 'merge-bookmarks-guide.html')));
  }
  for (const match of body.matchAll(/\]\((https:\/\/bookmark-nav\.luopeike\.com\/[^)]*)\)/g)) {
    const pathname = new URL(match[1]).pathname;
    const file = pathname.endsWith('/') ? pathname + 'index.html' : path.extname(pathname) ? pathname : pathname + '.html';
    assert.ok(fs.existsSync(path.join(root, file)), match[1]);
  }
});

test('discovery and mirror canonicals use standard Link relations without changing crawl policies', () => {
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  assert.ok(headers.includes('Link: </llms.txt>; rel="describedby"'));
  for (const locale of MERGE_LOCALES) assert.ok(headers.includes(`<https://bookmark-nav.luopeike.com/${locale.route}merge-bookmarks-guide>; rel="canonical"`));
  assert.match(headers, /\/llms\.txt\n  Content-Type: text\/plain; charset=utf-8\n  X-Robots-Tag: noindex/);
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://bookmark-nav.luopeike.com/sitemap.xml\n');
});
