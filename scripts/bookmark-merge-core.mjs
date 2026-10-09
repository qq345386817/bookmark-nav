// Browser-independent Netscape bookmark parser and merge/export engine.
// Source HTML is tokenized as data: no DOM insertion, scripts or resource loads.
export const LIMITS = Object.freeze({ bytesPerFile: 10 * 1024 * 1024, entriesPerFile: 25000, depth: 64 });
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™' };
export function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity] ?? match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function attributes(tag, decode) {
  const result = new Map();
  const body = tag.replace(/^<\/?\s*[\w:-]+/, '').replace(/>$/, '');
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!result.has(key)) result.set(key, decode(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return result;
}
function metadata(attrs) {
  const result = {};
  for (const key of ['add_date', 'last_modified']) {
    if (/^\d{1,16}$/.test(attrs.get(key) || '')) result[key] = attrs.get(key);
  }
  if (attrs.get('personal_toolbar_folder')?.toLowerCase() === 'true') result.personal_toolbar_folder = 'true';
  return result;
}
function allowedURL(value) {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'ftp:', 'file:', 'mailto:', 'about:', 'chrome:', 'edge:', 'safari:', 'chrome-extension:', 'moz-extension:'].includes(url.protocol);
  } catch { return false; }
}

export function parseBookmarkHTML(html, { decode = decodeEntities } = {}) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('emptyFile');
  if (html.length > LIMITS.bytesPerFile || new TextEncoder().encode(html).byteLength > LIMITS.bytesPerFile) throw new Error('largeFile');
  const root = { kind: 'folder', title: '', children: [], meta: {} };
  const stack = [root];
  let offset = 0, capture = null, pending = null, entries = 0, lists = 0;
  const ignored = [];
  const current = () => stack[stack.length - 1];
  const addEntry = () => { if (++entries > LIMITS.entriesPerFile) throw new Error('manyEntries'); };
  const finish = () => {
    if (!capture) return;
    addEntry();
    const title = decode(capture.text);
    if (capture.name === 'h3') {
      const folder = { kind: 'folder', title, meta: metadata(capture.attrs), children: [] };
      current().children.push(folder);
      pending = { folder, parent: current() };
    } else {
      const url = (capture.attrs.get('href') || '').trim();
      if (allowedURL(url)) current().children.push({ kind: 'bookmark', title, url, meta: metadata(capture.attrs) });
      else ignored.push({ title, url, reason: 'unsupportedURL' });
      pending = null;
    }
    capture = null;
  };
  while (offset < html.length) {
    const start = html.indexOf('<', offset);
    if (start === -1) { if (capture) capture.text += html.slice(offset); break; }
    if (capture) capture.text += html.slice(offset, start);
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end === -1) throw new Error('invalidFile');
      offset = end + 3; continue;
    }
    let end = start + 1, quote = '';
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === html.length) throw new Error('invalidFile');
    const tag = html.slice(start, end + 1);
    offset = end + 1;
    const match = /^<\s*(\/?)\s*([\w:-]+)/.exec(tag);
    if (!match) continue;
    const closing = !!match[1], name = match[2].toLowerCase();
    if (!closing && ['script', 'style', 'textarea', 'template', 'svg', 'iframe'].includes(name)) {
      const close = new RegExp(`<\\/\\s*${name}\\s*>`, 'gi'); close.lastIndex = offset;
      const found = close.exec(html);
      offset = found ? close.lastIndex : html.length; continue;
    }
    if (name === 'meta' && !closing) {
      const attrs = attributes(tag, decode);
      const declared = attrs.get('charset') || /charset\s*=\s*([^;\s]+)/i.exec(attrs.get('content') || '')?.[1];
      if (declared && !/^utf-?8$/i.test(declared)) throw new Error('encoding');
    }
    if (['a', 'h3'].includes(name)) {
      if (closing) {
        if (capture?.name !== name) throw new Error('invalidFile');
        finish();
      } else {
        if (capture) throw new Error('invalidFile');
        capture = { name, attrs: attributes(tag, decode), text: '' };
      }
    } else if (name === 'dl') {
      if (capture) throw new Error('invalidFile');
      if (closing) {
        if (stack.length === 1) throw new Error('invalidFile');
        stack.pop(); pending = null;
      } else {
        // Exclude the synthetic root and the export's outer DL from folder depth.
        if (stack.length > LIMITS.depth + 1) throw new Error('deepFile');
        if (pending && pending.parent === current()) stack.push(pending.folder);
        else stack.push(current());
        pending = null; lists++;
      }
    }
  }
  if (!lists || capture || stack.length !== 1) throw new Error('invalidFile');
  return { root, ignored, ...countTree(root) };
}

export function countTree(root) {
  let bookmarks = 0, folders = 0;
  const visit = node => { if (node.kind === 'bookmark') bookmarks++; else { if (node !== root) folders++; node.children.forEach(visit); } };
  visit(root); return { bookmarks, folders };
}

export function mergeBookmarks(inputs, { mergeFolders = true, duplicates = 'same-folder' } = {}) {
  if (!['keep-all', 'same-folder', 'everywhere'].includes(duplicates)) throw new Error('invalidPolicy');
  const root = { kind: 'folder', title: '', children: [], meta: {} };
  const folders = new WeakMap(), localURLs = new WeakMap(), globalURLs = new Map();
  const removed = [], retained = [], ignored = [];
  const renamedFolders = [];
  let mergedFolders = 0;
  const folderMap = parent => { if (!folders.has(parent)) folders.set(parent, new Map()); return folders.get(parent); };
  const urlMap = parent => { if (!localURLs.has(parent)) localURLs.set(parent, new Map()); return localURLs.get(parent); };
  function add(node, parent, path, source) {
    if (node.kind === 'folder') {
      const map = folderMap(parent);
      let folder = mergeFolders ? map.get(node.title) : null;
      if (folder) mergedFolders++;
      else {
        let title = node.title;
        if (!mergeFolders) {
          let suffix = 2;
          while (map.has(title)) title = `${node.title} (${suffix++})`;
          if (title !== node.title) renamedFolders.push({ source, originalTitle: node.title, title, path: [...path] });
        }
        const meta = { ...node.meta };
        if (!mergeFolders) delete meta.personal_toolbar_folder;
        folder = { kind: 'folder', title, meta, children: [] };
        parent.children.push(folder); map.set(title, folder);
      }
      node.children.forEach(child => add(child, folder, [...path, folder.title], source));
      return;
    }
    const entry = { source, title: node.title, url: node.url, path: [...path] };
    const map = duplicates === 'everywhere' ? globalURLs : urlMap(parent);
    const prior = map.get(node.url);
    if (duplicates !== 'keep-all' && prior) removed.push({ ...entry, kept: prior });
    else { parent.children.push({ ...node, meta: { ...node.meta } }); retained.push(entry); if (!prior) map.set(node.url, entry); }
  }
  inputs.forEach((input, index) => {
    let parent = root, path = [];
    // Chrome imports by folder path, so source namespaces prevent later re-merging.
    if (!mergeFolders) {
      parent = { kind: 'folder', title: `${index + 1} - ${input.name || 'Bookmarks'}`, meta: {}, children: [] };
      root.children.push(parent); path = [parent.title];
    }
    input.parsed.root.children.forEach(child => add(child, parent, path, input.name));
    input.parsed.ignored.forEach(entry => ignored.push({ ...entry, source: input.name }));
  });
  return { root, retained, removed, ignored, mergedFolders, renamedFolders, inputBookmarks: inputs.reduce((sum, input) => sum + input.parsed.bookmarks, 0), ...countTree(root), options: { mergeFolders, duplicates } };
}

export function exportBookmarkHTML(root) {
  const lines = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Merged bookmarks</TITLE>', '<H1>Merged bookmarks</H1>', '<DL><p>'];
  function write(node, depth) {
    const indent = '    '.repeat(depth);
    const meta = Object.entries(node.meta || {}).filter(([key, value]) => ['add_date', 'last_modified'].includes(key) ? /^\d{1,16}$/.test(value) : key === 'personal_toolbar_folder' && value === 'true').map(([key, value]) => ` ${key.toUpperCase()}="${escapeHTML(value)}"`).join('');
    if (node.kind === 'bookmark') {
      if (!allowedURL(node.url)) throw new Error('unsupportedURL');
      lines.push(`${indent}<DT><A HREF="${escapeHTML(node.url)}"${meta}>${escapeHTML(node.title)}</A>`);
    } else {
      lines.push(`${indent}<DT><H3${meta}>${escapeHTML(node.title)}</H3>`, `${indent}<DL><p>`);
      node.children.forEach(child => write(child, depth + 1));
      lines.push(`${indent}</DL><p>`);
    }
  }
  root.children.forEach(node => write(node, 1)); lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}
