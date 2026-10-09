# SEO And Deployment

The public custom domain is served by Cloudflare Pages, connected to this repository's `main` branch. The repository also has a GitHub Pages deployment. A Git push is not proof of a successful production deploy: check the **Cloudflare Pages** check run for the commit, then verify the custom domain.

## Canonical URL Convention

- `/` and locale roots such as `/zh-Hans/` are the home pages.
- Content pages use extensionless URLs, for example `/help` and `/zh-Hans/privacy-policy`.
- Physical files remain `help.html`, `zh-Hans/privacy-policy.html`, and so on.
- Cloudflare automatically redirects `.html` and `index.html` aliases to their clean paths. Canonical, Open Graph, hreflang, navigation, language picker and sitemap must use the final URL.
- Keep the Google verification file unchanged. Do not put error pages, unshipped pages, assets, tests or preview deployments in the sitemap.
- `404.html` disables Cloudflare's SPA fallback so missing URLs return HTTP 404 instead of the homepage with HTTP 200.
- `_headers` keeps responses untransformed (`no-transform`) to prevent proxy-injected analytics, and reinforces the merge tools' local-only CSP. Do not allow an analytics origin in the tool CSP just to silence an injection error. See [Cloudflare's no-transform guidance](https://developers.cloudflare.com/web-analytics/get-started/).

## Local Checks

```sh
node --test tests/seo-urls.test.mjs tests/static-server.test.mjs
node scripts/validate-seo.mjs
node scripts/dev-server.mjs --port=8776
```

Content updates are generated from `scripts/merge-guide-copy.mjs` and the existing merge translations:

```sh
node scripts/generate-content-pages.mjs
node scripts/generate-merge-pages.mjs
node scripts/generate-content-pages.mjs --check
node scripts/generate-merge-pages.mjs --check
node scripts/generate-llms.mjs
node scripts/generate-llms.mjs --check
node --test tests/*.test.mjs
node tests/content-browser.cjs
```

The eight localized guides use one real task, not separate doorway pages for keyword variants. HTML is complete without JavaScript; Markdown twins share the same source and are excluded from sitemap/search indexing with `X-Robots-Tag: noindex`. The visible FAQ is ordinary content, not a promise of FAQ rich results. `WebPage` and `BreadcrumbList` describe visible content; no review scores or software-release availability are invented. Support/privacy/home/help descriptions match their respective purpose. The public website and a prepared extension package are separate release states.

The development server emulates clean URLs and 404 routing on localhost. A plain Python file server does not resolve extensionless HTML URLs.

## Lightweight GEO

`llms.txt` is an optional concise navigation aid, generated from the current input limits and guide sources. It links to all eight Markdown guides, tools, release status and policies. Standard `Link: rel="describedby"` discovery and Markdown canonical headers are provided; Markdown and llms.txt are not separate Google indexing targets. No llms-full file, keyword stuffing, fabricated citations/ratings or special AI-ranking markup is used.

This is not a ranking or AI-citation guarantee. [Google's AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) says Google Search does not use llms.txt for visibility or ranking; the file follows the optional [llms.txt proposal](https://llmstxt.org/) for other clients. The same source generates the human and machine-readable guide, so update both together.

Robots policies and security protections are unchanged. The current wildcard robots rule permits crawling. An HTTP 200 response with a Googlebot or OAI-SearchBot user agent is only a diagnostic probe, not proof that actual crawler IPs pass Cloudflare filters. Actual AI-crawler requests require authenticated Cloudflare logs; the available API token failed authentication, so that part has not been verified. Do not weaken WAF or training/privacy policies to make this check pass.

## Content Release Acceptance: 2026-10-09

- `2c94bd3` publishes eight localized guides with real synthetic-input screenshots, help/home/support entries, internal links, unique descriptions and a 58-URL sitemap. Cloudflare Pages deployment succeeded. All 58 HTML URLs returned direct 200 with matching canonicals; eight Markdown mirrors returned the intended MIME and noindex header. Robots remained unchanged and unknown paths returned 404.
- Search Console's refreshed sitemap report now shows **Success**, last read 2026-10-09, with 42 discovered pages from the earlier sitemap. The previous "Couldn't fetch" snapshot below is historical. The new sitemap has 58 URLs; do not equate that with 58 discovered or indexed pages.
- The index overview is still dated 2026-10-04. Its old counts do not establish the current status of the new pages.
- Google's actual live inspection of the English guide at 18:39 China time reported indexability and detected one valid breadcrumb item. An indexing request was accepted. A successful test or request is not confirmation that the guide is already indexed.
- The extension source/package is unchanged. Website guide links are inside the web-only help block, and generated extension resources still pass their synchronization check.
- Run all content/SEO/llms regression tests and production browser checks when updating guide copy. Recheck Search Console after Google processes the updated sitemap; do not repeatedly submit the same URL to raise its priority.

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

### Acceptance And Pending Google Processing

- `bdae8e7`: canonical, Open Graph, hreflang, navigation and sitemap URL corrections.
- `1b5f887`: real 404, local clean-URL server, validators and eight regression tests.
- Both commits were pushed to `main`; Cloudflare Pages deployment succeeded. All 42 production sitemap URLs returned direct HTTP 200, matching canonical and no HTML `noindex`. The live XML is byte-identical to the commit and passes XML parsing. Unknown paths return HTTP 404; `.html` aliases remain HTTP 308; the Google verification file is unchanged.
- Google accepted a homepage indexing request. `sitemap.xml` was submitted and, after checking its fetchability, resubmitted once.
- The sitemap report still showed **Couldn't fetch / Unknown / 0 discovered** at the end of this session. This is not a successful sitemap-processing result.
- Google's live URL Inspection test of the XML at 2026-10-09 14:13:51 reported **Crawl allowed: Yes; Page fetch: Successful**. Manual-action and security reports showed no issues. No WAF, authentication, TLS or DNS security settings were weakened.
- The 44 crawled-but-unindexed entries remain subject to Google's re-crawl and indexing decisions. The alternate-canonical entry is not a defect to remove. Do not claim that those counts were cleared.

Next check: the sitemap report's fetch status and discovered count, then the homepage and important clean URLs in URL Inspection. Google retries failed sitemap fetches for a few days; if the report continues to fail despite successful live inspection, check actual sitemap-crawler requests in Cloudflare logs before changing protections or inventing alternate sitemap paths. See [Google's sitemap fetch troubleshooting](https://support.google.com/webmasters/answer/7451001?hl=en#sitemap_fetch_errors).

References: [Cloudflare routing and 404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google indexing report](https://support.google.com/webmasters/answer/7440203?hl=en).
