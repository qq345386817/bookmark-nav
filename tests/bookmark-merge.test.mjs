import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarkHTML, mergeBookmarks, exportBookmarkHTML, LIMITS } from '../scripts/bookmark-merge-core.mjs';

const html = content => `<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><DL><p>${content}</DL><p>`;
const link = (url, title = 'Link', meta = '') => `<DT><A HREF="${url}" ${meta}>${title}</A>`;
const folder = (title, children = '', meta = '') => `<DT><H3 ${meta}>${title}</H3><DL><p>${children}</DL><p>`;
const input = (name, content) => ({ name, parsed: parseBookmarkHTML(html(content)) });
const sources = () => [
  input('first.html', folder('Work', link('https://example.com/a', 'Preferred', 'ADD_DATE="123"')) + folder('Empty')),
  input('second.html', folder('Work', link('https://example.com/a', 'Other') + link('https://example.com/a#one') + link('https://example.com/a#two')) + folder('Learning', link('https://example.com/a'))),
];

test('reads optional DT/P closings, nested folders, Unicode and dates', () => {
  const p = input('x', folder('研究 &amp; Work', folder('Inner', link('https://example.com/?a=1&amp;b=2', '中文 &#x1f516; <b>Docs</b>', 'ADD_DATE="17000"')) + folder('Empty'), 'PERSONAL_TOOLBAR_FOLDER="true"')).parsed;
  assert.equal(p.bookmarks, 1); assert.equal(p.folders, 3);
  const top = p.root.children[0];
  assert.equal(top.title, '研究 & Work'); assert.equal(top.meta.personal_toolbar_folder, 'true');
  const l = top.children[0].children[0];
  assert.equal(l.url, 'https://example.com/?a=1&b=2'); assert.equal(l.title, '中文 🔖 Docs'); assert.equal(l.meta.add_date, '17000');
});
test('quoted > and single/unquoted attributes do not break token boundaries', () => {
  const p = input('x', "<DT><A href='https://example.com/?x=>&amp;y=1' ADD_DATE=123>One &quot;two&quot;</A>").parsed;
  assert.equal(p.root.children[0].url, 'https://example.com/?x=>&y=1');
  assert.equal(p.root.children[0].meta.add_date, '123');
});
test('blank titles and title whitespace survive export unchanged', () => {
  const p = input('x', folder(' Folder ', link('https://x.test', '') + link('https://x.test/two', '  Two  '))).parsed;
  assert.equal(p.root.children[0].title, ' Folder ');
  assert.equal(p.root.children[0].children[0].title, '');
  assert.deepEqual(parseBookmarkHTML(exportBookmarkHTML(p.root)).root, p.root);
});
test('same-folder default retains cross-folder occurrences and fragment targets', () => {
  const p = mergeBookmarks(sources());
  assert.equal(p.inputBookmarks, 5); assert.equal(p.bookmarks, 4); assert.equal(p.removed.length, 1);
  assert.equal(p.mergedFolders, 1); assert.equal(p.folders, 3);
  assert.equal(p.root.children[0].children[0].title, 'Preferred');
  assert.equal(p.root.children[0].children[0].meta.add_date, '123');
  assert.equal(p.removed[0].kept.source, 'first.html');
  assert.equal(p.root.children[1].children.length, 0);
});
test('global duplicate policy removes cross-folder copy, keep-all preserves all', () => {
  assert.equal(mergeBookmarks(sources(), { duplicates: 'everywhere' }).bookmarks, 3);
  assert.equal(mergeBookmarks(sources(), { duplicates: 'keep-all' }).bookmarks, 5);
});
test('disabling folder merging keeps separate folders and their links', () => {
  const p = mergeBookmarks(sources(), { mergeFolders: false });
  assert.equal(p.bookmarks, 5); assert.equal(p.folders, 6); assert.equal(p.mergedFolders, 0);
  assert.deepEqual(p.root.children.map(node => node.title), ['1 - first.html', '2 - second.html']);
  assert.equal(p.retained[0].path[0], '1 - first.html');
});
test('separate source folders stay distinct for identical filenames and toolbar markers', () => {
  const inputs = [input('bookmarks.html', folder('Bookmarks bar', link('https://x.test/first'), 'PERSONAL_TOOLBAR_FOLDER="true"')), input('bookmarks.html', folder('Bookmarks bar', link('https://x.test/second'), 'PERSONAL_TOOLBAR_FOLDER="true"'))];
  const original = JSON.stringify(inputs);
  const p = mergeBookmarks(inputs, { mergeFolders: false });
  assert.deepEqual(p.root.children.map(node => node.title), ['1 - bookmarks.html', '2 - bookmarks.html']);
  assert.equal(exportBookmarkHTML(p.root).includes('PERSONAL_TOOLBAR_FOLDER'), false);
  assert.equal(JSON.stringify(inputs), original);
  assert.deepEqual(parseBookmarkHTML(exportBookmarkHTML(p.root)).root, p.root);
});
test('separate mode disambiguates duplicate sibling names for path-based browser import', () => {
  const p = mergeBookmarks([input('x', folder('Work', link('https://x.test/first')) + folder('Work', link('https://x.test/second')) + folder('Work (2)', link('https://x.test/third')))], { mergeFolders: false });
  assert.deepEqual(p.root.children[0].children.map(node => node.title), ['Work', 'Work (2)', 'Work (2) (2)']);
  assert.equal(p.renamedFolders.length, 2);
  assert.equal(new Set(p.retained.map(node => JSON.stringify(node.path))).size, 3);
});
test('folder paths and case are distinct; map keys cannot collide with prototypes', () => {
  const p = mergeBookmarks([input('x', folder('__proto__', link('https://x.test')) + folder('Work', folder('Same', link('https://x.test'))) + folder('work', folder('Same', link('https://x.test'))))]);
  assert.equal(p.bookmarks, 3); assert.equal(p.removed.length, 0); assert.equal(p.folders, 5);
});
test('different query strings, fragments, protocol and www are preserved', () => {
  const urls = ['https://x.test/?a=1', 'https://x.test/?a=2', 'https://x.test/#a', 'https://x.test/#b', 'https://www.x.test/', 'http://x.test/'];
  assert.equal(mergeBookmarks([input('x', urls.map(u => link(u)).join(''))], { duplicates: 'everywhere' }).bookmarks, urls.length);
});
test('roundtrip retains hierarchy, dates, empty folders and safely escaped data', () => {
  const src = [input('x', folder('&lt;img src=x onerror=alert(1)&gt;', link('https://x.test/?a=&quot;x&quot;&amp;b=2', '&lt;script&gt;evil&lt;/script&gt;', 'ADD_DATE="123" LAST_MODIFIED="456"')) + folder('Empty'))];
  const p = mergeBookmarks(src); const output = exportBookmarkHTML(p.root);
  assert.ok(!output.includes('<script>evil'));
  assert.deepEqual(parseBookmarkHTML(output).root, p.root);
  assert.equal(JSON.stringify(src), JSON.stringify([input('x', folder('&lt;img src=x onerror=alert(1)&gt;', link('https://x.test/?a=&quot;x&quot;&amp;b=2', '&lt;script&gt;evil&lt;/script&gt;', 'ADD_DATE="123" LAST_MODIFIED="456"')) + folder('Empty'))]));
});
test('scripts, comments, templates and resource tags are never treated as bookmarks', () => {
  const p = input('x', '<script><A HREF="https://bad.test">bad</A></script><!-- <A HREF="https://bad.test">bad</A> --><template><A HREF="https://bad.test">bad</A></template><img src="https://bad.test/a.png">' + link('https://good.test')).parsed;
  assert.equal(p.bookmarks, 1); assert.equal(p.root.children[0].url, 'https://good.test');
});
test('unsupported, missing and malformed URLs are explicitly recorded', () => {
  const p = input('x', link('javascript:alert(1)') + link('data:text/html,evil') + link('/relative') + '<DT><A>Missing</A>' + link('https://good.test')).parsed;
  assert.equal(p.bookmarks, 1); assert.equal(p.ignored.length, 4);
  const merged = mergeBookmarks([{ name: 'x', parsed: p }]);
  assert.equal(merged.ignored.length, 4); assert.ok(merged.ignored.every(e => e.source === 'x'));
});
test('invalid, incomplete, empty and legacy-encoding input fails clearly', () => {
  for (const text of ['', '<p>Not an export</p>', '<DL><A HREF="https://x.test">x', '<DL><H3>Oops</H3>', '<DL></DL></DL>', '<META charset="windows-1252"><DL></DL>']) {
    assert.throws(() => parseBookmarkHTML(text));
  }
  assert.equal(parseBookmarkHTML('<DL><p></DL><p>').bookmarks, 0);
});
test('limits reject oversized, too deep or excessive entries', () => {
  assert.throws(() => parseBookmarkHTML('x'.repeat(LIMITS.bytesPerFile + 1)), /largeFile/);
  assert.throws(() => parseBookmarkHTML('<DL>'.repeat(66) + '</DL>'.repeat(66)), /deepFile/);
  assert.throws(() => input('x', link('https://x.test').repeat(LIMITS.entriesPerFile + 1)), /manyEntries/);
});
test('large result can roundtrip without losing or mutating inputs', () => {
  const a = input('a', folder('Many', Array.from({ length: 3000 }, (_, i) => link(`https://x.test/${i}`)).join('')));
  const b = input('b', folder('Many', Array.from({ length: 3000 }, (_, i) => link(`https://x.test/${i + 2000}`)).join('')));
  const originals = JSON.stringify([a, b]); const p = mergeBookmarks([a, b]);
  assert.equal(p.bookmarks, 5000); assert.equal(p.removed.length, 1000);
  assert.equal(parseBookmarkHTML(exportBookmarkHTML(p.root)).bookmarks, 5000);
  assert.equal(JSON.stringify([a, b]), originals);
});

test('UTF-8 byte limit accepts exactly 10 MiB and rejects the next byte', () => {
  const wrapper = html(link('https://x.test'));
  const padding = LIMITS.bytesPerFile - Buffer.byteLength(wrapper);
  const exact = wrapper.replace('</DL>', ' '.repeat(padding) + '</DL>');
  assert.equal(Buffer.byteLength(exact), LIMITS.bytesPerFile);
  assert.equal(parseBookmarkHTML(exact).bookmarks, 1);
  assert.throws(() => parseBookmarkHTML(exact + ' '), /largeFile/);
  const multibyte = html(link('https://x.test', '中'.repeat(Math.ceil(LIMITS.bytesPerFile / 3))));
  assert.ok(multibyte.length < LIMITS.bytesPerFile);
  assert.throws(() => parseBookmarkHTML(multibyte), /largeFile/);
});

test('64 named folder levels exclude the outer export list', () => {
  const nested = levels => {
    let content = link('https://x.test');
    for (let i = 0; i < levels; i++) content = folder(`Level ${i}`, content);
    return html(content);
  };
  assert.equal(parseBookmarkHTML(nested(64)).folders, 64);
  assert.throws(() => parseBookmarkHTML(nested(65)), /deepFile/);
});

test('25,000 entries per input can produce a larger export with an explicit re-read limit', () => {
  const full = prefix => input(prefix, Array.from({ length: LIMITS.entriesPerFile }, (_, i) => link(`https://x.test/${prefix}/${i}`)).join(''));
  const a = full('a'), b = full('b');
  const merged = mergeBookmarks([a, b]);
  assert.equal(a.parsed.bookmarks, 25000);
  assert.equal(merged.bookmarks, 50000);
  const output = exportBookmarkHTML(merged.root);
  assert.equal((output.match(/<DT><A /g) || []).length, 50000);
  assert.throws(() => parseBookmarkHTML(output), /manyEntries/);
});
