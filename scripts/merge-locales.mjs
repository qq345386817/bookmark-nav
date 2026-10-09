export const MERGE_LOCALES = [
  { id: 'en', lang: 'en', route: '', name: 'English', store: 'en', help: 'en' },
  { id: 'zh-Hans', lang: 'zh-Hans', route: 'zh-Hans/', name: '简体中文', store: 'zh_CN', help: 'zh-Hans' },
  { id: 'zh-Hant', lang: 'zh-Hant', route: 'zh-Hant/', name: '繁體中文', store: 'zh_TW', help: 'zh-Hant' },
  { id: 'ja', lang: 'ja', route: 'ja/', name: '日本語', store: 'ja', help: 'ja' },
  { id: 'ko', lang: 'ko', route: 'ko/', name: '한국어', store: 'ko', help: 'ko' },
  { id: 'de-DE', lang: 'de', route: 'de-DE/', name: 'Deutsch', store: 'de', help: 'de' },
  { id: 'fr-FR', lang: 'fr', route: 'fr-FR/', name: 'Français', store: 'fr', help: 'fr' },
  { id: 'es-ES', lang: 'es', route: 'es-ES/', name: 'Español', store: 'es', help: 'es' },
];

export function mergeLocale(language = 'en') {
  const normalized = language.replaceAll('_', '-').toLowerCase();
  if (normalized.startsWith('zh')) return MERGE_LOCALES[/^zh-(?:tw|hk|mo|hant)(?:-|$)/.test(normalized) || normalized.includes('-hant') ? 2 : 1];
  return MERGE_LOCALES.find(locale => locale.lang === normalized.split('-')[0]) || MERGE_LOCALES[0];
}
