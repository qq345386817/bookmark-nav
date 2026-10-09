import en from './merge-translations/en.mjs';
import zhHans from './merge-translations/zh-Hans.mjs';
import zhHant from './merge-translations/zh-Hant.mjs';
import ja from './merge-translations/ja.mjs';
import ko from './merge-translations/ko.mjs';
import de from './merge-translations/de-DE.mjs';
import fr from './merge-translations/fr-FR.mjs';
import es from './merge-translations/es-ES.mjs';
import { mergeLocale } from './merge-locales.mjs';

export const MERGE_TRANSLATIONS = { en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, 'de-DE': de, 'fr-FR': fr, 'es-ES': es };
export function mergeTranslation(language) { return MERGE_TRANSLATIONS[mergeLocale(language).id]; }
export function formatMessage(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Missing translation value: ${key}`);
    return String(values[key]);
  });
}
