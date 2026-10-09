import { LIMITS, parseBookmarkHTML, mergeBookmarks, exportBookmarkHTML } from './bookmark-merge-core.mjs';

const zh = document.documentElement.lang.startsWith('zh');
const strings = zh ? {
  emptyFile: '文件为空，请选择浏览器导出的书签 HTML。', largeFile: '每个文件不能超过 10 MiB。',
  manyEntries: '每个文件最多支持 25,000 个书签及文件夹。', deepFile: '文件夹层级超过支持范围（64 层）。',
  invalidFile: '无法读取书签结构。请重新从浏览器导出 Netscape 格式的书签 HTML。',
  encoding: '目前仅支持 UTF-8，请用当前浏览器重新导出这份书签。',
  unsupportedURL: '缺失、无效或不支持的 URL（含 javascript: / data:）',
  choose: '尚未选择文件', reading: '正在读取…', ready: '可以预览',
  bookmarks: '个书签', folders: '个文件夹', ignored: '个未导入项',
  loaded: '两份文件已就绪。', needFiles: '选择两份导出文件，或试用示例。',
  previewReady: '预览已生成，请检查重复项和未导入项。',
  changed: '设置或文件已变更，请重新生成预览。', reviewed: '预览已确认。',
  kept: '保留', removed: '移除重复项', skipped: '未导入',
  root: '根目录', noneRemoved: '当前规则没有移除任何书签。', noneIgnored: '没有未导入项。',
  emptyResult: '结果没有可导出的书签；请检查输入文件与未导入项。',
  skippedWarning: n => `${n} 个条目不会导入。`,
  sample: '示例已加载。',
  showing: (start, end, total) => `显示 ${start}–${end} / ${total} 项`,
  keptAt: entry => `保留自 ${entry.source} · ${entry.path.join(' / ') || '根目录'}`,
  readAt: (n, f, i) => `${n} 个书签 · ${f} 个文件夹${i ? ` · ${i} 个未导入项` : ''}`,
  download: '已生成下载文件。原始文件与浏览器书签未被修改。',
} : {
  emptyFile: 'This file is empty. Choose a browser bookmark HTML export.', largeFile: 'Each file must be 10 MiB or smaller.',
  manyEntries: 'Each file can contain up to 25,000 bookmarks and folders.', deepFile: 'This file exceeds the supported folder depth (64 levels).',
  invalidFile: 'The bookmark structure could not be read. Re-export your bookmarks in Netscape HTML format.',
  encoding: 'Only UTF-8 exports are supported. Re-export this file with a current browser.',
  unsupportedURL: 'Missing, invalid or unsupported URL (including javascript: / data:)',
  choose: 'No file selected', reading: 'Reading…', ready: 'Ready to preview',
  bookmarks: 'bookmarks', folders: 'folders', ignored: 'skipped entries',
  loaded: 'Both files ready.', needFiles: 'Choose two exports, or try the sample files.',
  previewReady: 'Preview ready. Review duplicates and skipped entries.',
  changed: 'Files or options changed. Generate a new preview.', reviewed: 'Preview confirmed.',
  kept: 'Kept', removed: 'Duplicate removed', skipped: 'Skipped',
  root: 'Root', noneRemoved: 'No bookmarks were removed with these options.', noneIgnored: 'No entries were skipped.',
  emptyResult: 'There are no bookmarks to export. Check your files and skipped entries.',
  skippedWarning: n => `${n} entries will not be imported.`,
  sample: 'Samples loaded.',
  showing: (start, end, total) => `Showing ${start}–${end} of ${total} entries`,
  keptAt: entry => `Kept from ${entry.source} · ${entry.path.join(' / ') || 'Root'}`,
  readAt: (n, f, i) => `${n} bookmarks · ${f} folders${i ? ` · ${i} skipped entries` : ''}`,
  download: 'Download created. Your original files and browser bookmarks were not changed.',
};
const $ = id => document.getElementById(id);
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
