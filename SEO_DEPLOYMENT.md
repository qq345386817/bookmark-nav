# SEO And Deployment

The public custom domain is served by Cloudflare Pages, connected to this repository's `main` branch. The repository also has a GitHub Pages deployment. A Git push is not proof of a successful production deploy: check the **Cloudflare Pages** check run for the commit, then verify the custom domain.

## Canonical URL Convention

- `/` and locale roots such as `/zh-Hans/` are the home pages.
- Content pages use extensionless URLs, for example `/help` and `/zh-Hans/privacy-policy`.
- Physical files remain `help.html`, `zh-Hans/privacy-policy.html`, and so on.
- Cloudflare automatically redirects `.html` and `index.html` aliases to their clean paths. Canonical, Open Graph, hreflang, navigation, language picker and sitemap must use the final URL.
- Keep the Google verification file unchanged. Do not put error pages, unshipped pages, assets, tests or preview deployments in the sitemap.
- `404.html` disables Cloudflare's SPA fallback so missing URLs return HTTP 404 instead of the homepage with HTTP 200.

## Local Checks

```sh
node --test tests/seo-urls.test.mjs tests/static-server.test.mjs
node scripts/validate-seo.mjs
node scripts/dev-server.mjs --port=8776
```

The development server emulates clean URLs and 404 routing on localhost. A plain Python file server does not resolve extensionless HTML URLs.

## Production Acceptance

1. Confirm the Cloudflare Pages check run succeeded for the published commit.
2. Fetch `https://bookmark-nav.luopeike.com/sitemap.xml`: valid XML, canonical URLs only.
3. Each listed URL must return HTTP 200 directly, with a self-referencing canonical and no `noindex` response header/tag.
4. `.html` aliases must still redirect, and an unknown path must return HTTP 404.
5. Confirm Google verification, CSS and images still load; compare locale navigation with hreflang.
6. Submit `sitemap.xml` in the matching Search Console URL-prefix property; request indexing of the homepage and important changed canonical URLs.

Search Console's `Crawled - currently not indexed` is not an HTTP fetch error and cannot be forced to disappear. Re-crawl requests and sitemap success do not guarantee indexing. `Alternate page with proper canonical tag` is expected for duplicate aliases; don't request indexing of those aliases or remove their canonical.

## 2026-10-09 Repair Scope

The report showed 44 crawled-but-unindexed URLs, one alternate URL, and no manually submitted sitemap. Google live testing confirmed the homepage is indexable. Production served `.html` aliases as 308 redirects while HTML metadata and sitemap still declared them canonical. Unknown paths served the homepage with HTTP 200.

This repair normalizes the 42 already-published pages, adds a real 404 and regression checks. The local bookmark-merging feature, its extra sitemap entries and extension-1.3 privacy drafts are deliberately excluded from this release. Existing pending working-tree content is preserved separately from the selected commit content.

References: [Cloudflare routing and 404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google indexing report](https://support.google.com/webmasters/answer/7440203?hl=en).
