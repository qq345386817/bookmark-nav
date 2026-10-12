import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readSitemap, pageFile, pageModified, renderSitemap, generatedSitemap } from '../scripts/sitemap.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('canonical URLs map to real HTML sources, never machine-readable mirrors or aliases', () => {
  assert.equal(pageFile('https://bookmark-nav.luopeike.com/'), 'index.html');
  assert.equal(pageFile('https://bookmark-nav.luopeike.com/zh-Hans/'), 'zh-Hans/index.html');
  assert.equal(pageFile('https://bookmark-nav.luopeike.com/merge-bookmarks-guide'), 'merge-bookmarks-guide.html');
  for (const url of ['https://example.com/', 'https://bookmark-nav.luopeike.com/help.html', 'https://bookmark-nav.luopeike.com/llms.txt', 'https://bookmark-nav.luopeike.com/help?x=1', 'https://bookmark-nav.luopeike.com/help#part']) assert.throws(() => pageFile(url));
});

test('XML parsing respects sitemap namespace and whitespace rather than line formatting', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-sitemap-test-'));
  const file = path.join(dir, 'test.xml');
  try {
    fs.writeFileSync(file, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://bookmark-nav.luopeike.com/</loc><lastmod>2026-10-09T12:00:00+08:00</lastmod></url></urlset>');
    assert.deepEqual(readSitemap(file), [{ url: 'https://bookmark-nav.luopeike.com/', lastmod: '2026-10-09T12:00:00+08:00' }]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rendering rejects missing, future and duplicate metadata and does not fabricate priority', () => {
  const entry = { url: 'https://bookmark-nav.luopeike.com/', lastmod: '2026-10-09T12:00:00+08:00' };
  const now = Date.parse('2026-10-12T00:00:00Z');
  assert.ok(renderSitemap([entry], now).includes('<lastmod>2026-10-09T12:00:00+08:00</lastmod>'));
  assert.ok(!renderSitemap([entry], now).includes('<priority>'));
  assert.throws(() => renderSitemap([entry, entry], now));
  assert.throws(() => renderSitemap([{ ...entry, lastmod: '' }], now));
  assert.throws(() => renderSitemap([{ ...entry, lastmod: '2026-02-30T00:00:00Z' }], now));
  assert.throws(() => renderSitemap([{ ...entry, lastmod: '2027-01-01T00:00:00Z' }], now));
});

test('sitemap dates match actual Git commits and regeneration cannot refresh unchanged pages', () => {
  const entries = readSitemap(path.join(root, 'sitemap.xml'));
  assert.equal(entries.length, 58);
  for (const entry of entries) assert.equal(entry.lastmod, pageModified(root, pageFile(entry.url)), entry.url);
  assert.equal(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), generatedSitemap(root));
  assert.equal(generatedSitemap(root), generatedSitemap(root));
});
