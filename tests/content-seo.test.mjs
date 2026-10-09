import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { MERGE_LOCALES } from '../scripts/merge-locales.mjs';
import { MERGE_TRANSLATIONS } from '../scripts/bookmark-merge-i18n.mjs';
import { GUIDE_COPY } from '../scripts/merge-guide-copy.mjs';
import { parseBookmarkHTML, mergeBookmarks } from '../scripts/bookmark-merge-core.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('guide translations are complete, five-step and conservative about extension availability', () => {
  for (const locale of MERGE_LOCALES) {
    const copy = GUIDE_COPY[locale.id];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(GUIDE_COPY.en).sort());
    assert.equal(copy.steps.length, 5);
    for (const value of Object.values(copy)) {
      if (Array.isArray(value)) value.forEach(step => assert.ok(step.trim()));
      else assert.ok(typeof value === 'string' && value.trim());
    }
    assert.ok(copy.extension.includes('1.3.1'));
    assert.ok(copy.steps[0].includes('chrome://bookmarks'));
    assert.notEqual(copy.helpDescription, copy.homeDescription);
  }
});

test('generated guides and markdown share content, images, source links and canonical languages', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-content-pages.mjs'), '--check']);
  for (const locale of MERGE_LOCALES) {
    const copy = GUIDE_COPY[locale.id];
    const html = fs.readFileSync(path.join(root, locale.route, 'merge-bookmarks-guide.html'), 'utf8');
    const md = fs.readFileSync(path.join(root, locale.route, 'merge-bookmarks-guide.md'), 'utf8');
    assert.ok(html.includes(`hreflang="${locale.lang}"`));
    assert.ok(md.includes(copy.title)); assert.ok(md.includes(copy.intro)); assert.ok(md.includes(copy.extension));
    assert.equal((html.match(/<li>/g) || []).length, 10);
    assert.ok(html.includes('type="text/markdown"'));
    assert.ok(html.includes('support.google.com/chrome/answer/96816'));
    const image = fs.readFileSync(path.join(root, 'images/merge-guide', locale.id + '.png'));
    assert.equal(image.readUInt32BE(16), 1280); assert.equal(image.readUInt32BE(20), 800);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(graph['@graph'][0].inLanguage, locale.lang);
    assert.equal(graph['@graph'][0].name, copy.title);
    assert.equal(graph['@graph'][1]['@type'], 'BreadcrumbList');
    assert.ok(!JSON.stringify(graph).includes('aggregateRating'));
    assert.ok(!JSON.stringify(graph).includes('FAQPage'));
    assert.ok(!html.includes('{{'));
  }
});

test('home and help connect to tools and guides; descriptions match page purpose', () => {
  for (const locale of MERGE_LOCALES) {
    const descriptions = [];
    for (const name of ['index', 'help', 'support', 'privacy-policy']) {
      const html = fs.readFileSync(path.join(root, locale.route, name + '.html'), 'utf8');
      descriptions.push(html.match(/name="description" content="([^"]+)"/)[1]);
      if (['index', 'help'].includes(name)) {
        assert.ok(html.includes('href="merge-bookmarks-guide"'));
        assert.ok(html.includes('href="merge-bookmarks"'));
        assert.equal((html.match(/<!-- merge-(home|help):start -->/g) || []).length, 1);
      }
    }
    assert.equal(new Set(descriptions).size, 4);
    const tool = fs.readFileSync(path.join(root, locale.route, 'merge-bookmarks.html'), 'utf8');
    assert.ok(tool.includes('href="merge-bookmarks-guide"'));
    assert.ok(tool.includes('property="og:image"'));
  }
});

test('the guide sample really has six inputs, five outputs and one same-folder duplicate', () => {
  const first = '<DL><DT><H3>Work</H3><DL><DT><A HREF="https://developer.chrome.com/docs/extensions/">Chrome docs</A><DT><A HREF="https://example.com/guide#setup">Setup</A></DL></DL>';
  const second = '<DL><DT><H3>Work</H3><DL><DT><A HREF="https://developer.chrome.com/docs/extensions/">Other title</A><DT><A HREF="https://example.com/guide#troubleshooting">Troubleshooting</A><DT><A HREF="https://example.com/?a=1">Notes</A></DL><DT><H3>Learning</H3><DL><DT><A HREF="https://developer.chrome.com/docs/extensions/">Learning</A></DL></DL>';
  const result = mergeBookmarks([{ name: 'first.html', parsed: parseBookmarkHTML(first) }, { name: 'second.html', parsed: parseBookmarkHTML(second) }], { duplicates: 'same-folder', mergeFolders: true });
  assert.equal(result.inputBookmarks, 6); assert.equal(result.bookmarks, 5); assert.equal(result.removed.length, 1);
  assert.equal(result.retained.filter(entry => entry.url === 'https://developer.chrome.com/docs/extensions/').length, 2);
  assert.ok(result.retained.some(entry => entry.url.endsWith('#setup')));
  assert.ok(result.retained.some(entry => entry.url.endsWith('#troubleshooting')));
});

test('markdown mirrors are not additional sitemap or search-index targets', () => {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 58);
  assert.ok(!sitemap.includes('.md'));
  assert.match(fs.readFileSync(path.join(root, '_headers'), 'utf8'), /\/\*\.md\n  Content-Type: text\/markdown; charset=utf-8\n  X-Robots-Tag: noindex/);
});
