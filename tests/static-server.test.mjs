import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

let root, server, base;
test.before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'bookmark-nav-routes-'));
  for (const [name, value] of Object.entries({ 'index.html': 'home', 'help.html': 'help', 'zh-Hans/index.html': 'Chinese home', '404.html': 'not found', 'scripts/example.mjs': 'export default 1;', '.git/config': 'do-not-serve' })) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), value);
  }
  server = spawn(process.execPath, [fileURLToPath(new URL('../scripts/dev-server.mjs', import.meta.url)), '--port=0', '--dir=' + root]);
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    server.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    server.once('error', reject); server.once('exit', code => { if (code) reject(new Error('Server exited: ' + code)); });
  });
});
test.after(async () => { if (server?.exitCode === null) { server.kill(); await once(server, 'exit'); } await fs.rm(root, { recursive: true, force: true }); });

test('HTML and index aliases redirect once to the clean URL, preserving query strings', async () => {
  for (const [url, target] of [['/help.html?q=1', '/help?q=1'], ['/index.html', '/'], ['/zh-Hans/index.html', '/zh-Hans/'], ['/zh-Hans', '/zh-Hans/']]) {
    const response = await fetch(base + url, { redirect: 'manual' });
    assert.equal(response.status, 308); assert.equal(response.headers.get('location'), target);
    assert.equal((await fetch(base + target)).status, 200);
  }
});
test('clean routes and assets have correct response types', async () => {
  const page = await fetch(base + '/help'); assert.equal(await page.text(), 'help'); assert.match(page.headers.get('content-type'), /text\/html/);
  const script = await fetch(base + '/scripts/example.mjs'); assert.equal(script.status, 200); assert.equal(script.headers.get('content-type'), 'text/javascript');
});
test('missing pages return a real 404 instead of the homepage, and dotfiles are not served', async () => {
  const missing = await fetch(base + '/missing/deep/path'); assert.equal(missing.status, 404); assert.equal(await missing.text(), 'not found');
  const privateFile = await fetch(base + '/.git/config'); assert.equal(privateFile.status, 404); assert.doesNotMatch(await privateFile.text(), /do-not-serve/);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});
