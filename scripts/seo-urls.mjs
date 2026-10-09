export const SITE_ORIGIN = 'https://bookmark-nav.luopeike.com';

export function canonicalPath(pathname) {
  if (/\/google[a-z0-9]+\.html$/.test(pathname)) return pathname;
  return pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
}

export function canonicalUrl(value, base = SITE_ORIGIN + '/') {
  const url = new URL(value, base);
  if (url.origin === SITE_ORIGIN) url.pathname = canonicalPath(url.pathname);
  return url.href;
}

export function cleanPageReference(value, base) {
  if (value.startsWith('#')) return value;
  let url;
  try { url = new URL(value, base); } catch { return value; }
  if (url.origin !== SITE_ORIGIN || canonicalPath(url.pathname) === url.pathname) return value;
  if (/^https?:\/\//.test(value) || value.startsWith('//')) return canonicalUrl(value, base);
  if (value.startsWith('/')) return canonicalPath(url.pathname) + url.search + url.hash;
  return value.replace(/(^|\/)index\.html(?=[?#]|$)/, (_, slash) => slash || './').replace(/\.html(?=[?#]|$)/, '');
}

// This mechanical migration touches URL-bearing attributes in the site's static markup only.
export function normalizePageUrls(html, file) {
  const base = SITE_ORIGIN + '/' + file;
  return html.replace(/<(?:a|link|option|meta)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, tag => {
    const attribute = /^<meta\b/i.test(tag) ? (/\bproperty\s*=\s*(["'])og:url\1/i.test(tag) ? 'content' : null)
      : /^<option\b/i.test(tag) ? 'value' : 'href';
    if (!attribute) return tag;
    const pattern = new RegExp(`(\\b${attribute}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
    return tag.replace(pattern, (_, prefix, quote, value) => prefix + quote + cleanPageReference(value, base) + quote);
  });
}

export function normalizeSitemap(xml) {
  return xml.replace(/<loc>([^<]+)<\/loc>/g, (_, url) => `<loc>${canonicalUrl(url)}</loc>`);
}
