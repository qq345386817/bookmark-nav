import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS } from './bookmark-merge-core.mjs';
import { MERGE_LOCALES } from './merge-locales.mjs';
import { GUIDE_COPY } from './merge-guide-copy.mjs';

const origin = 'https://bookmark-nav.luopeike.com/';
export function renderLlms() {
  return [
    '# Bookmark Nav', '',
    '> A Chrome bookmark new-tab dashboard and a standalone, local bookmark HTML merger. The website and Chrome extension have separate release states.', '',
    'The website combines two UTF-8 Netscape bookmark HTML exports. Users preview kept, duplicate and skipped entries, then download merged HTML. No account or extension is required. Selected bookmark files are processed in tab memory, not uploaded or used for analytics.', '',
    `Input limits per file: ${LIMITS.bytesPerFile / 1024 / 1024} MiB, ${LIMITS.entriesPerFile.toLocaleString('en-US')} bookmarks and folders, and ${LIMITS.depth} named folder levels excluding the outer list. A merged output can exceed these input limits. Keep original exports.`, '',
    'Default duplicate removal compares exact URLs within the same merged folder. Cross-folder occurrences, query strings, ordinary fragments, protocols and www differences remain distinct. Matching folders require the same name and parent path. Unsupported or unsafe URLs, including javascript: and data:, are listed as skipped.', '',
    'The downloaded HTML preserves supported URLs, titles, hierarchy and available dates. It does not include icons, descriptions, tags or sync metadata. Browser import adds bookmarks, not replaces them. Chrome drops empty folders and resets folder dates. Repeated imports may add copies.', '',
    'This does not merge Chrome accounts or control browser sync. The Chrome Web Store listing determines extension availability. Direct import, where available in the installed extension, adds a separate folder using current dates and provides checked undo, not an atomic transaction or native HTML-import equivalence.', '',
    '## Task guides', '',
    ...MERGE_LOCALES.map(locale => `- [${GUIDE_COPY[locale.id].title}](${origin}${locale.route}merge-bookmarks-guide.md): ${locale.name} guide; export, merge, backup, import, example and limitations. Markdown twin of the public HTML guide.`), '',
    '## Web tools', '',
    ...MERGE_LOCALES.map(locale => `- [${locale.name} bookmark HTML merger](${origin}${locale.route}merge-bookmarks): Local file selection, duplicate review and HTML download.`), '',
    '## Product and policies', '',
    `- [Bookmark Nav](${origin}): Chrome dashboard and standalone web-tool overview.`,
    `- [Help](${origin}help): Installation, search and bookmark-merging help.`,
    `- [Release status](${origin}changelog): Published website updates versus prepared extension builds.`,
    `- [Privacy policy](${origin}privacy-policy): Local bookmark/file processing, settings and import records; translations are linked on the page.`,
    `- [Support](${origin}support): Contact information; do not send private bookmark files.`,
    '- [Chrome Web Store](https://chromewebstore.google.com/detail/bookmark-nav/flhhneimccgeopajgojnaflmbibagcgb): Public extension version and installation.',
    '- [Chrome import/export documentation](https://support.google.com/chrome/answer/96816?hl=en): Browser-side HTML import and export instructions.', '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../llms.txt');
  const body = renderLlms();
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) throw new Error('llms.txt is stale. Run node scripts/generate-llms.mjs.');
    console.log('llms.txt matches current product facts, limits and eight-language guide links.');
  } else { fs.writeFileSync(file, body); console.log('Generated concise llms.txt from current limits and guide sources.'); }
}
