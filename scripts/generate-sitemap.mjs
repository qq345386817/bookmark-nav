import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedSitemap } from './sitemap.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'sitemap.xml');
const body = generatedSitemap(root);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(file, 'utf8') !== body) throw new Error('Sitemap is stale. Commit changed HTML, then run node scripts/generate-sitemap.mjs.');
  console.log('Sitemap lastmod matches committed HTML history, not generation time.');
} else {
  fs.writeFileSync(file, body);
  console.log('Generated sitemap with lastmod from actual committed page changes.');
}
