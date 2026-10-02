/** 支援的介面語言。 */
export type Locale = 'zh-TW' | 'en' | 'ja'

export const LOCALES: { id: Locale; label: string; htmlLang: string }[] = [
  { id: 'zh-TW', label: '繁中', htmlLang: 'zh-Hant' },
  { id: 'en', label: 'EN', htmlLang: 'en' },
  { id: 'ja', label: '日本語', htmlLang: 'ja' },
]

export const LOCALE_IDS = LOCALES.map((l) => l.id) as readonly Locale[]

/** 多語字串：每種語言各一份。 */
export type L10n = Record<Locale, string>

/** 依瀏覽器語言挑選預設語言；無法判斷時用英文。 */
export function detectLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  for (const raw of languages) {
    const lang = raw.toLowerCase()
    if (lang.startsWith('zh')) return 'zh-TW'
    if (lang.startsWith('ja')) return 'ja'
    if (lang.startsWith('en')) return 'en'
  }
  return 'en'
}
