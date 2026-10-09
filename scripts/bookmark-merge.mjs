import { mergeTranslation, formatMessage } from './bookmark-merge-i18n.mjs';

import { LIMITS, parseBookmarkHTML, mergeBookmarks, exportBookmarkHTML } from './bookmark-merge-core.mjs';

const translated = mergeTranslation(document.documentElement.lang).messages;
const strings = {
  ...translated,
  skippedWarning: n => formatMessage(translated.skippedWarning, { n }),
  showing: (start, end, total) => formatMessage(translated.showing, { start, end, total }),
  keptAt: entry => formatMessage(translated.keptAt, { source: entry.source, path: entry.path.join(' / ') || translated.root }),
  readAt: (n, f, i) => formatMessage(translated.readAt, { n, f, ignoredPart: i ? formatMessage(translated.ignoredPart, { i }) : '' }),
};
const $ = id => document.getElementById(id);
$('merge-language').addEventListener('change', event => { window.location.href = event.target.value; });
const state = { files: [null, null], versions: [0, 0], loading: [false, false], plan: null, page: 0, view: 'retained' };
export function currentMergePlan() { return state.plan; }
const decoder = document.createElement('textarea');
function decode(value) {
  // Escape every literal '<' first, so even malformed source cannot create tags.
  decoder.innerHTML = value.replace(/</g, '&lt;');
  return decoder.value;
}
function invalidate(message = strings.changed) {
  state.plan = null; state.page = 0;
  $('reviewed').checked = false;
  $('result').hidden = true;
  $('download').disabled = true;
  $('report').disabled = true;
  $('preview').disabled = !state.files.every(Boolean) || state.loading.some(Boolean);
  $('status').textContent = message;
  if ($('extension-next-step')) $('extension-next-step').hidden = true;
  document.dispatchEvent(new CustomEvent('bookmark-merge:changed'));
}
function updateFile(index) {
  const file = state.files[index];
  $(`file-status-${index}`).textContent = file ? strings.readAt(file.parsed.bookmarks, file.parsed.folders, file.parsed.ignored.length) : strings.choose;
}
async function loadFile(index, file) {
  const version = ++state.versions[index];
  state.files[index] = null; state.loading[index] = Boolean(file);
  $(`file-error-${index}`).textContent = '';
  invalidate(strings.needFiles);
  updateFile(index);
  if (!file) return;
  $(`file-status-${index}`).textContent = strings.reading;
  try {
    if (file.size > LIMITS.bytesPerFile) throw new Error('largeFile');
    const buffer = await file.arrayBuffer();
    if (state.versions[index] !== version) return;
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new Error('encoding'); }
    const parsed = parseBookmarkHTML(text, { decode });
    state.files[index] = { name: file.name, parsed };
  } catch (error) {
    if (state.versions[index] !== version) return;
    $(`file-error-${index}`).textContent = strings[error.message] || strings.invalidFile;
  } finally {
    if (state.versions[index] === version) {
      state.loading[index] = false; updateFile(index);
      invalidate(state.files.every(Boolean) ? strings.loaded : strings.needFiles);
    }
  }
}
for (const index of [0, 1]) {
  $(`file-${index}`).addEventListener('change', event => loadFile(index, event.target.files[0]));
}
$('duplicates').addEventListener('change', () => invalidate());
$('merge-folders').addEventListener('change', () => invalidate());
$('reset').addEventListener('click', () => {
  state.files = [null, null]; state.loading = [false, false];
  for (const index of [0, 1]) {
    state.versions[index]++; $(`file-${index}`).value = '';
    $(`file-error-${index}`).textContent = ''; updateFile(index);
  }
  invalidate(strings.needFiles);
});
const sampleFiles = [
  { name: 'laptop-bookmarks.html', body: '<DL><p><DT><H3 ADD_DATE="1700000000">Work</H3><DL><p><DT><A HREF="https://developer.chrome.com/docs/extensions/" ADD_DATE="1700000001">Chrome docs</A><DT><A HREF="https://example.com/guide#setup">Setup guide</A></DL><p><DT><H3>Empty folder</H3><DL><p></DL><p></DL><p>' },
  { name: 'desktop-bookmarks.html', body: '<DL><p><DT><H3>Work</H3><DL><p><DT><A HREF="https://developer.chrome.com/docs/extensions/">Chrome developer guide</A><DT><A HREF="https://example.com/guide#troubleshooting">Troubleshooting</A><DT><A HREF="https://example.com/?a=1&amp;b=2">Project notes</A></DL><p><DT><H3>Learning</H3><DL><p><DT><A HREF="https://developer.chrome.com/docs/extensions/">Chrome learning</A></DL><p></DL><p>' },
];
$('sample').addEventListener('click', () => {
  for (const index of [0, 1]) {
    state.versions[index]++; state.loading[index] = false; $(`file-${index}`).value = '';
    const sample = new DataTransfer();
    sample.items.add(new File([sampleFiles[index].body], sampleFiles[index].name, { type: 'text/html' }));
    $(`file-${index}`).files = sample.files;
    $(`file-error-${index}`).textContent = '';
    state.files[index] = { name: sampleFiles[index].name, parsed: parseBookmarkHTML(sampleFiles[index].body, { decode }) };
    updateFile(index);
  }
  invalidate(strings.sample);
});

function showRows() {
  const rows = state.plan?.[state.view] || [];
  const size = 50, start = state.page * size, end = Math.min(start + size, rows.length);
  $('preview-body').replaceChildren();
  for (const item of rows.slice(start, end)) {
    const tr = document.createElement('tr');
    for (const text of [item.source, item.path?.join(' / ') || strings.root, item.title || '—', item.url || '—', item.kept ? strings.keptAt(item.kept) : item.reason ? strings[item.reason] || item.reason : strings.kept]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    $('preview-body').append(tr);
  }
  $('preview-table').hidden = !rows.length;
  $('empty-view').hidden = Boolean(rows.length);
  $('empty-view').textContent = state.view === 'removed' ? strings.noneRemoved : state.view === 'ignored' ? strings.noneIgnored : strings.emptyResult;
  $('page-info').textContent = rows.length ? strings.showing(start + 1, end, rows.length) : '';
  $('previous').disabled = state.page === 0;
  $('next').disabled = end >= rows.length;
  document.querySelectorAll('[data-preview-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.previewView === state.view));
    button.classList.toggle('selected', button.dataset.previewView === state.view);
  });
}
function showTree() {
  $('tree').replaceChildren();
  // The complete bookmark/folder hierarchy is included in the download.
  // Bound this text preview independently of result-table pagination.
  let seen = 0;
  function visit(node, depth) {
    if (++seen > 200) return;
    const div = document.createElement('div');
    div.style.paddingInlineStart = `${Math.min(depth, 8) * 16}px`;
    div.textContent = node.kind === 'folder' ? `[${node.title || strings.root}]` : node.title;
    $('tree').append(div);
    for (const child of node.children || []) {
      if (seen > 200) break;
      visit(child, depth + 1);
    }
  }
  for (const node of state.plan.root.children) {
    if (seen > 200) break;
    visit(node, 0);
  }
  $('tree-limit').hidden = seen <= 200;
}
$('preview').addEventListener('click', () => {
  if (!state.files.every(Boolean) || state.loading.some(Boolean)) return;
  state.plan = mergeBookmarks(state.files, { duplicates: $('duplicates').value, mergeFolders: $('merge-folders').checked });
  state.page = 0; state.view = 'retained'; $('reviewed').checked = false;
  $('download').disabled = true; $('report').disabled = false;
  $('kept-count').textContent = state.plan.bookmarks;
  $('removed-count').textContent = state.plan.removed.length;
  $('merged-count').textContent = state.plan.mergedFolders;
  $('ignored-count').textContent = state.plan.ignored.length;
  $('skipped-warning').hidden = !state.plan.ignored.length;
  $('skipped-message').textContent = strings.skippedWarning(state.plan.ignored.length);
  $('result').hidden = false;
  $('status').textContent = state.plan.bookmarks ? strings.previewReady : strings.emptyResult;
  showRows(); showTree();
  document.dispatchEvent(new CustomEvent('bookmark-merge:preview'));
  $('result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});
document.querySelectorAll('[data-preview-view]').forEach(button => button.addEventListener('click', () => {
  state.view = button.dataset.previewView; state.page = 0; showRows();
}));
$('review-skipped').addEventListener('click', () => { state.view = 'ignored'; state.page = 0; showRows(); });
$('previous').addEventListener('click', () => { if (state.page > 0) state.page--; showRows(); });
$('next').addEventListener('click', () => {
  if ((state.page + 1) * 50 < state.plan[state.view].length) state.page++;
  showRows();
});
$('reviewed').addEventListener('change', () => {
  $('download').disabled = !state.plan?.bookmarks || !$('reviewed').checked;
  $('status').textContent = !state.plan?.bookmarks ? strings.emptyResult : $('reviewed').checked ? strings.reviewed : strings.previewReady;
});
function download(body, mime, suffix) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url;
  anchor.download = `bookmark-nav-merged-${new Date().toISOString().slice(0, 10)}.${suffix}`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = strings.download;
  if (suffix === 'html' && $('extension-next-step')) $('extension-next-step').hidden = false;
}
$('download').addEventListener('click', () => {
  if (state.plan?.bookmarks && $('reviewed').checked) download(exportBookmarkHTML(state.plan.root), 'text/html;charset=utf-8', 'html');
});
$('report').addEventListener('click', () => {
  if (!state.plan) return;
  download(JSON.stringify({ generatedAt: new Date().toISOString(), files: state.files.map(file => file.name), options: state.plan.options, inputBookmarks: state.plan.inputBookmarks, keptBookmarks: state.plan.bookmarks, mergedFolders: state.plan.mergedFolders, renamedFolders: state.plan.renamedFolders, removed: state.plan.removed, ignored: state.plan.ignored }, null, 2), 'application/json;charset=utf-8', 'report.json');
});
invalidate(strings.needFiles);
