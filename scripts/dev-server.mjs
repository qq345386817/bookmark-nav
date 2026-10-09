import http from 'node:http';
import path from 'node:path';
import { stat, readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalPath } from './seo-urls.mjs';

const args = process.argv.slice(2);
const port = Number(args.find(arg => arg.startsWith('--port='))?.slice(7) || 8776);
const root = await realpath(args.find(arg => arg.startsWith('--dir='))?.slice(6) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const types = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

async function findFile(name) {
  try {
    const file = await realpath(path.resolve(root, '.' + name));
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) return null;
    return file;
  } catch { return null; }
}

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
    const clean = canonicalPath(pathname);
    if (clean !== pathname) { response.writeHead(308, { Location: clean + url.search }); response.end(); return; }
    let file = await findFile(pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    if (!file && !path.extname(pathname)) file = await findFile(pathname + '.html');
    if (!file && !pathname.endsWith('/') && await findFile(pathname + '/index.html')) {
      response.writeHead(308, { Location: pathname + '/' + url.search }); response.end(); return;
    }
    const status = file ? 200 : 404;
    file ||= await findFile('/404.html');
    response.writeHead(status, { 'Content-Type': types[path.extname(file || '')] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : file ? await readFile(file) : 'Not found');
  } catch { response.writeHead(400); response.end('Bad request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Static site (Cloudflare-style clean URLs): http://127.0.0.1:${server.address().port}`));
