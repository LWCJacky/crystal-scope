import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import en from './messages/en'
import ja from './messages/ja'
import zhTW from './messages/zh-TW'
import { TERMS, type TermKey } from './terms'
import type { L10n, Locale } from './types'

export type MessageKey = keyof typeof zhTW

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { 'zh-TW': zhTW, en, ja }

type Params = Record<string, string | number>

/** 以 {name} 代入參數。 */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`))
}

/** 純函式版本（無 Vue 相依），供資料層與測試使用。 */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return interpolate(MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key, params)
}

/** 專業名詞：英文為原文；其他語言顯示「譯名 (English)」。 */
export function termText(locale: Locale, key: TermKey): string {
  const t = TERMS[key]
  return locale === 'en' || t[locale] === t.en ? t.en : `${t[locale]} (${t.en})`
}

/** 專業名詞的兩段式顯示（標題用）：label 為譯名，en 為原文；英文介面時 en 為空。 */
export function termParts(locale: Locale, key: TermKey): { label: string; en: string } {
  const t = TERMS[key]
  return locale === 'en' || t[locale] === t.en ? { label: t.en, en: '' } : { label: t[locale], en: t.en }
}

export function useI18n() {
  const settings = useSettingsStore()
  const locale = computed<Locale>(() => settings.values.locale)
  return {
    locale,
    t: (key: MessageKey, params?: Params) => translate(locale.value, key, params),
    /** 多語資料欄位。 */
    l: (text: L10n) => text[locale.value] ?? text.en,
    term: (key: TermKey) => termText(locale.value, key),
    termParts: (key: TermKey) => termParts(locale.value, key),
  }
}
