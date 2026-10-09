import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPath, canonicalUrl, cleanPageReference, normalizePageUrls, normalizeSitemap } from '../scripts/seo-urls.mjs';

test('Cloudflare HTML aliases resolve to one clean canonical path', () => {
  assert.equal(canonicalPath('/help.html'), '/help');
  assert.equal(canonicalPath('/index.html'), '/');
  assert.equal(canonicalPath('/zh-Hans/index.html'), '/zh-Hans/');
  assert.equal(canonicalPath('/zh-Hans/privacy-policy.html'), '/zh-Hans/privacy-policy');
  assert.equal(canonicalPath('/google8bdd3bd447b6e703.html'), '/google8bdd3bd447b6e703.html');
});

test('relative page references retain directories, query strings and fragments', () => {
  const base = 'https://bookmark-nav.luopeike.com/zh-Hans/help.html';
  for (const [input, output] of [['index.html', './'], ['../index.html', '../'], ['../help.html#search', '../help#search'], ['help.html?q=1&amp;x=2', 'help?q=1&amp;x=2'], ['../images/app-icon.svg', '../images/app-icon.svg']]) {
    assert.equal(cleanPageReference(input, base), output);
    assert.equal(new URL(output, base).href, canonicalUrl(input, base));
  }
});

test('external links, verification files, descriptions and scripts are not rewritten', () => {
  const html = `<a href="https://support.google.com/help.html">Help</a><link href="style/base.css"><meta name="description" content="Read help.html"><script>const x = 'help.html';</script><a href="google8bdd3bd447b6e703.html">Verify</a>`;
  assert.equal(normalizePageUrls(html, 'index.html'), html);
});

test('canonical, Open Graph, alternate, navigation and language-picker URLs agree', () => {
  const html = `<link rel="canonical" href="https://bookmark-nav.luopeike.com/help.html"><meta property="og:url" content="https://bookmark-nav.luopeike.com/help.html"><link rel="alternate" href="https://bookmark-nav.luopeike.com/zh-Hans/help.html"><a title="a > b" href="index.html">Home</a><option value='zh-Hans/help.html'>Chinese</option>`;
  const actual = normalizePageUrls(html, 'help.html');
  assert.ok(actual.includes('href="https://bookmark-nav.luopeike.com/help"'));
  assert.ok(actual.includes('content="https://bookmark-nav.luopeike.com/help"'));
  assert.ok(actual.includes('href="https://bookmark-nav.luopeike.com/zh-Hans/help"'));
  assert.ok(actual.includes('href="./"'));
  assert.ok(actual.includes("value='zh-Hans/help'"));
  assert.equal(normalizePageUrls(actual, 'help.html'), actual);
});

test('sitemap normalization preserves home and language roots, without invented dates', () => {
  assert.equal(normalizeSitemap('<url><loc>https://bookmark-nav.luopeike.com/help.html</loc></url>'), '<url><loc>https://bookmark-nav.luopeike.com/help</loc></url>');
  const xml = '<loc>https://bookmark-nav.luopeike.com/</loc><loc>https://bookmark-nav.luopeike.com/zh-Hans/</loc>';
  assert.equal(normalizeSitemap(xml), xml);
});
