import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { MERGE_LOCALES, mergeLocale } from '../scripts/merge-locales.mjs';
import { MERGE_TRANSLATIONS, mergeTranslation, formatMessage } from '../scripts/bookmark-merge-i18n.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all eight catalogs have complete page, dynamic and native-import translations', () => {
  assert.equal(MERGE_LOCALES.length, 8);
  for (const locale of MERGE_LOCALES) {
    const translated = MERGE_TRANSLATIONS[locale.id];
    for (const section of ['page', 'messages', 'native']) {
      assert.deepEqual(Object.keys(translated[section]).sort(), Object.keys(MERGE_TRANSLATIONS.en[section]).sort(), `${locale.id}/${section}`);
      for (const [key, value] of Object.entries(translated[section])) {
        assert.equal(typeof value, 'string'); assert.ok(value.trim(), `${locale.id}/${key}`);
        assert.deepEqual(placeholders(value), placeholders(MERGE_TRANSLATIONS.en[section][key]), `${locale.id}/${key}`);
      }
    }
    assert.equal(mergeTranslation(locale.lang), translated);
  }
});

test('browser language variants resolve correctly without mixing traditional and simplified Chinese', () => {
  for (const [input, expected] of [['zh-CN', 'zh-Hans'], ['zh_SG', 'zh-Hans'], ['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh-MO', 'zh-Hant'], ['zh-Hant-TW', 'zh-Hant'], ['zh-Hans-CN', 'zh-Hans'], ['de-AT', 'de-DE'], ['fr-CA', 'fr-FR'], ['es-MX', 'es-ES'], ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['en-GB', 'en'], ['pt-BR', 'en']]) assert.equal(mergeLocale(input).id, expected);
});

test('generated pages expose reciprocal eight-language SEO and complete language choices', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-merge-pages.mjs'), '--check']);
  for (const locale of MERGE_LOCALES) {
    const html = fs.readFileSync(path.join(root, locale.route, 'merge-bookmarks.html'), 'utf8');
    assert.ok(html.includes(`<html lang="${locale.lang}">`));
    assert.ok(html.includes(`rel="canonical" href="https://bookmark-nav.luopeike.com/${locale.route}merge-bookmarks"`));
    assert.equal((html.match(/<option value="\/[^"]*merge-bookmarks"/g) || []).length, 8);
    for (const other of MERGE_LOCALES) assert.ok(html.includes(`hreflang="${other.lang}" href="https://bookmark-nav.luopeike.com/${other.route}merge-bookmarks"`));
    assert.ok(!html.includes('{{')); assert.ok(html.includes("connect-src 'none'"));
    assert.ok(fs.readFileSync(path.join(root, locale.route, 'index.html'), 'utf8').includes('href="merge-bookmarks"'));
  }
});

test('local-only deployment headers cover the root and every locale', () => {
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  assert.ok(headers.includes('no-transform'));
  for (const rule of ['/merge-bookmarks\n', '/*/merge-bookmarks\n']) assert.ok(headers.includes(rule));
  assert.ok(!headers.includes('cloudflareinsights.com'));
});

test('message formatting preserves Unicode and zero counts and rejects missing values', () => {
  assert.equal(formatMessage('{n} · {path}', { n: 0, path: '資料夾 / Études' }), '0 · 資料夾 / Études');
  assert.throws(() => formatMessage('{missing}', {}), /Missing translation value/);
});
