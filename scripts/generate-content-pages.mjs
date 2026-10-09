import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MERGE_LOCALES } from './merge-locales.mjs';
import { MERGE_TRANSLATIONS } from './bookmark-merge-i18n.mjs';
import { GUIDE_COPY } from './merge-guide-copy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://bookmark-nav.luopeike.com/';
const check = process.argv.includes('--check');
const template = fs.readFileSync(path.join(root, 'templates/merge-bookmarks-guide.html.tmpl'), 'utf8');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const changed = [];
function output(file, body) {
  const full = path.join(root, file);
  if (check) { if (!fs.existsSync(full) || fs.readFileSync(full, 'utf8') !== body) changed.push(file); }
  else fs.writeFileSync(full, body);
}
function insertSection(body, name, content, boundary) {
  const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`;
  const block = start + content + end;
  if (body.includes(start)) return body.slice(0, body.indexOf(start)) + block + body.slice(body.indexOf(end) + end.length);
  if (!body.includes(boundary)) throw new Error(`Missing content boundary: ${boundary}`);
  return body.replace(boundary, block + boundary);
}
for (const locale of MERGE_LOCALES) {
  const copy = GUIDE_COPY[locale.id], page = MERGE_TRANSLATIONS[locale.id].page;
  const prefix = locale.route ? '../' : '', canonical = origin + locale.route + 'merge-bookmarks-guide';
  const imagePath = `${prefix}images/merge-guide/${locale.id}.png`;
  // The FAQ is visible HTML. No FAQ rich-result claims or invented software ratings.
  const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': canonical + '#page', url: canonical, name: copy.title, description: copy.description, inLanguage: locale.lang, dateModified: '2026-10-09', isPartOf: { '@type': 'WebSite', name: 'Bookmark Nav', url: origin } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: page.home, item: origin + locale.route }, { '@type': 'ListItem', position: 2, name: copy.title, item: canonical }] },
  ] }).replaceAll('<', '\\u003c');
  const support = fs.readFileSync(path.join(root, locale.route, 'support.html'), 'utf8').match(/<nav[^>]*>.*?<a href="support"[^>]*>([^<]+)<\/a>/s)?.[1];
  if (!support) throw new Error(`${locale.id}: missing support label`);
  const values = { ...page, ...copy, lang: locale.lang, prefix, canonical, support, imagePath, imageURL: origin + `images/merge-guide/${locale.id}.png`, storeURL: 'https://chromewebstore.google.com/detail/bookmark-nav/flhhneimccgeopajgojnaflmbibagcgb', chromeURL: 'https://support.google.com/chrome/answer/96816?hl=' + locale.help, structuredData };
  values.alternates = MERGE_LOCALES.map(other => `  <link rel="alternate" hreflang="${other.lang}" href="${origin}${other.route}merge-bookmarks-guide">`).join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${origin}merge-bookmarks-guide">`;
  values.languageOptions = MERGE_LOCALES.map(other => `<option value="/${other.route}merge-bookmarks-guide"${locale.id === other.id ? ' selected' : ''}>${escape(other.name)}</option>`).join('');
  values.steps = copy.steps.map(step => `<li>${escape(step)}</li>`).join('');
  const raw = ['alternates', 'languageOptions', 'steps', 'structuredData'];
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`${locale.id}: missing guide key ${key}`);
    return raw.includes(key) ? values[key] : escape(values[key]);
  });
  output(locale.route + 'merge-bookmarks-guide.html', html);
  const markdown = [
    `# ${copy.title}`, '', `Bookmark Nav | 2026-10-09 | ${canonical}`, '', copy.intro, '', `[${page.toolLink}](${origin}${locale.route}merge-bookmarks)`, '',
    `## ${copy.stepsTitle}`, '', ...copy.steps.map((step, index) => `${index + 1}. ${step}`), '',
    `## ${copy.exampleTitle}`, '', copy.example, '', `![${copy.imageAlt}](${values.imageURL})`, '', copy.imageCaption, '',
    `## ${copy.rulesTitle}`, '', page.duplicateHelp, '', page.folderHelp, '', page.exportHelp, '',
    `## ${copy.safetyTitle}`, '', copy.safety, '', page.limitsHelp, '', page.largeOutput, '', page.chromeLimits, '',
    `## ${copy.extensionTitle}`, '', copy.extension, '', `[${page.getExtension}](${values.storeURL})`, '',
    `## ${copy.questionsTitle}`, '', `### ${copy.uploadQuestion}`, '', page.privacyHelp, '', `### ${copy.syncQuestion}`, '', copy.syncAnswer, '', `### ${copy.datesQuestion}`, '', page.originalDates, '', page.chromeLimits, '',
    `## ${copy.sourcesTitle}`, '', `[${copy.chromeSource}](${values.chromeURL})`, '', `[${page.help}](${origin}${locale.route}help)`, '', `[${page.privacy}](${origin}${locale.route}privacy-policy)`, '',
  ].join('\n');
  output(locale.route + 'merge-bookmarks-guide.md', markdown);
  for (const [file, description] of [['index.html', copy.homeDescription], ['help.html', copy.helpDescription], ['support.html', copy.supportDescription], ['privacy-policy.html', copy.privacyDescription]]) {
    const relative = locale.route + file;
    let body = fs.readFileSync(path.join(root, relative), 'utf8')
      .replace(/(<meta name="description" content=")[^"]*/, '$1' + escape(description))
      .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + escape(description));
    if (file === 'help.html') {
      const content = `<section class="content-merge-help"><h2>${escape(page.toolLink)}</h2><p>${escape(copy.intro)}</p><p><a href="merge-bookmarks">${escape(page.toolLink)}</a> · <a href="merge-bookmarks-guide">${escape(copy.guideLink)}</a></p><h3>${escape(copy.extensionTitle)}</h3><p>${escape(copy.extension)}</p></section>`;
      body = insertSection(body, 'merge-help', content, '</main>');
    } else if (file === 'support.html') {
      const content = `<section class="content-merge-help"><h2>${escape(page.toolLink)}</h2><p>${escape(copy.supportDescription)}</p><p><a href="merge-bookmarks">${escape(page.toolLink)}</a> · <a href="merge-bookmarks-guide">${escape(copy.guideLink)}</a></p></section>`;
      body = insertSection(body, 'merge-support', content, '</main>');
    } else if (file === 'index.html') {
      const content = `<section class="content-merge-help"><h2>${escape(page.toolLink)}</h2><p>${escape(copy.intro)}</p><p><a href="merge-bookmarks">${escape(page.toolLink)}</a> · <a href="merge-bookmarks-guide">${escape(copy.guideLink)}</a></p></section>`;
      body = insertSection(body, 'merge-home', content, '</main>');
    }
    if (['help.html', 'index.html', 'support.html'].includes(file) && !body.includes(`href="${prefix}style/merge-guide.css"`)) body = body.replace('</head>', `  <link rel="stylesheet" href="${prefix}style/merge-guide.css">\n</head>`);
    output(relative, body);
  }
}
const changelogFile = 'changelog.html';
let changelog = fs.readFileSync(path.join(root, changelogFile), 'utf8');
const releaseNotes = '<section class="content-merge-help"><h2>Website: eight-language bookmark HTML merger</h2><p>2026-10-09: the standalone <a href="merge-bookmarks">bookmark merger</a> is live in eight languages. Merge two local exports, review exact-URL duplicates and download HTML without installing an extension. Read the <a href="merge-bookmarks-guide">export, merge and import guide</a>.</p><h3>Chrome extension 1.3.1: prepared release candidate</h3><p>The prepared build adds the localized import tool, backup, additive import into a new folder and guarded undo. This website update does not publish the Chrome extension. Check the <a href="https://chromewebstore.google.com/detail/bookmark-nav/flhhneimccgeopajgojnaflmbibagcgb">Chrome Web Store listing</a> and your installed version for availability; the website tool can be used now.</p></section>';
changelog = insertSection(changelog, 'merge-changelog', releaseNotes, '<h2>Version 1.2.0</h2>');
changelog = changelog.replace('does not require an account, cloud sync, analytics, or bookmark migration.', 'does not require an account or a cloud bookmark service. The website merger processes exported files locally; it does not merge Chrome accounts or replace Chrome sync.');
if (!changelog.includes('href="style/merge-guide.css"')) changelog = changelog.replace('</head>', '  <link rel="stylesheet" href="style/merge-guide.css">\n</head>');
output(changelogFile, changelog);
if (changed.length) throw new Error(`Stale guide/content pages: ${changed.join(', ')}. Run node scripts/generate-content-pages.mjs.`);
console.log(check ? 'Eight-language guides, Markdown mirrors and content descriptions are synchronized.' : 'Generated eight-language guides, Markdown mirrors, help/home entries and page-specific descriptions.');
