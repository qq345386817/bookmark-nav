import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MERGE_LOCALES } from './merge-locales.mjs';
import { MERGE_TRANSLATIONS } from './bookmark-merge-i18n.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const origin = 'https://bookmark-nav.luopeike.com/';
const template = fs.readFileSync(path.join(root, 'templates/merge-bookmarks.html.tmpl'), 'utf8');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const mismatches = [];
for (const locale of MERGE_LOCALES) {
  const translation = MERGE_TRANSLATIONS[locale.id];
  const values = { ...translation.page, choose: translation.messages.choose, lang: locale.lang, prefix: locale.route ? '../' : '', canonical: origin + locale.route + 'merge-bookmarks', helpLanguage: locale.help };
  values.alternates = MERGE_LOCALES.map(other => `  <link rel="alternate" hreflang="${other.lang}" href="${origin}${other.route}merge-bookmarks">`).join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${origin}merge-bookmarks">`;
  values.languageOptions = MERGE_LOCALES.map(other => `<option value="/${other.route}merge-bookmarks"${locale.id === other.id ? ' selected' : ''}>${escape(other.name)}</option>`).join('');
  const body = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`${locale.id}: missing template key ${key}`);
    return ['alternates', 'languageOptions'].includes(key) ? values[key] : escape(values[key]);
  });
  const file = path.join(root, locale.route, 'merge-bookmarks.html');
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) mismatches.push(locale.id); }
  else fs.writeFileSync(file, body);
}
if (mismatches.length) throw new Error(`Stale merge pages: ${mismatches.join(', ')}. Run node scripts/generate-merge-pages.mjs.`);
console.log(`Eight-language merge pages ${check ? 'are synchronized' : 'generated'}.`);
