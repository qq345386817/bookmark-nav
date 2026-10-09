const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
let playwright = process.env.PLAYWRIGHT_MODULE || 'playwright';
try { require.resolve(playwright); }
catch {
  playwright = fs.readdirSync(path.join(os.homedir(), '.npm/_npx')).map(name => path.join(os.homedir(), '.npm/_npx', name, 'node_modules/playwright')).find(file => fs.existsSync(path.join(file, 'package.json')));
  if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright package.');
}
const { chromium } = require(playwright);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = (process.env.BOOKMARK_MERGE_BASE_URL || 'http://127.0.0.1:8776').replace(/\/$/, '');
const output = process.env.BOOKMARK_QA_OUTPUT || path.join(os.tmpdir(), 'bookmark-content-qa');

(async () => {
  let browser;
  try {
    fs.mkdirSync(output, { recursive: true });
    const { MERGE_LOCALES } = await import(pathToFileURL(path.join(root, 'scripts/merge-locales.mjs')));
    const { GUIDE_COPY } = await import(pathToFileURL(path.join(root, 'scripts/merge-guide-copy.mjs')));
    browser = await chromium.launch({ executablePath, headless: true, ...(process.env.BOOKMARK_MERGE_PROXY_SERVER ? { proxy: { server: process.env.BOOKMARK_MERGE_PROXY_SERVER } } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
    const errors = [], externalRequests = [], observations = [];
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base + '/')) externalRequests.push(request.url()); });
    });
    for (const [index, locale] of MERGE_LOCALES.entries()) {
      const page = await context.newPage(), copy = GUIDE_COPY[locale.id];
      await page.goto(`${base}/${locale.route}help`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('.content-merge-help a[href="merge-bookmarks-guide"]').click();
      await page.locator('h1').filter({ hasText: copy.title }).waitFor();
      assert.equal(await page.title(), copy.title + ' | Bookmark Nav');
      assert.equal(await page.locator('#steps li').count(), 5);
      assert.equal(await page.locator('#questions h3').count(), 3);
      const image = page.locator('#example img');
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('#example img').complete && document.querySelector('#example img').naturalWidth === 1280);
      assert.equal(await image.getAttribute('alt'), copy.imageAlt);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${locale.id}-guide-desktop.png`) });
      await page.setViewportSize({ width: 320, height: 740 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, locale.id);
      await page.screenshot({ path: path.join(output, `${locale.id}-guide-mobile.png`), fullPage: true });
      const next = MERGE_LOCALES[(index + 1) % MERGE_LOCALES.length];
      await page.locator('#guide-language').selectOption(`/${next.route}merge-bookmarks-guide`);
      await page.locator('h1').filter({ hasText: GUIDE_COPY[next.id].title }).waitFor();
      await page.locator('.guide-intro a').click();
      await page.locator('#sample').click(); await page.locator('#preview').click();
      assert.equal(await page.locator('#kept-count').textContent(), '5');
      await page.locator('#reviewed').check();
      const downloaded = page.waitForEvent('download'); await page.locator('#download').click();
      await (await downloaded).saveAs(path.join(output, `${locale.id}-guide-flow.html`));
      await page.close();
      observations.push(`${locale.id}: help -> localized guide, real screenshot, 320px layout, language switch -> tool -> sample preview and HTML download passed.`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    const report = { base, browser: await browser.version(), locales: 8, viewports: ['1280x900', '320x740'], errors, externalRequests, observations };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
