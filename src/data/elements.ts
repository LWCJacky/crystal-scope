import type { L10n } from '../i18n/types'

export interface ElementStyle {
  name: L10n
  color: string
  /** 示意顯示半徑（Å）；僅供辨識相對大小，非真實離子或原子半徑。 */
  displayRadius: number
}

const n = (zh: string, en: string, ja: string): L10n => ({ 'zh-TW': zh, en, ja })

/** 元素配色沿用課程投影片的慣例，並確保在淺色與深色背景都可辨識。 */
export const ELEMENTS: Record<string, ElementStyle> = {
  X: { name: n('示意原子', 'Model atom', '模式原子'), color: '#4f7fe0', displayRadius: 0.12 },
  Fe: { name: n('鐵', 'Iron', '鉄'), color: '#5b7fd6', displayRadius: 0.5 },
  Cu: { name: n('銅', 'Copper', '銅'), color: '#3fa58f', displayRadius: 0.5 },
  Mg: { name: n('鎂', 'Magnesium', 'マグネシウム'), color: '#9aa3ad', displayRadius: 0.55 },
  U: { name: n('鈾', 'Uranium', 'ウラン'), color: '#4a5be0', displayRadius: 0.5 },
  Cs: { name: n('銫', 'Caesium', 'セシウム'), color: '#8f9fe6', displayRadius: 0.85 },
  Cl: { name: n('氯', 'Chlorine', '塩素'), color: '#2e9a5c', displayRadius: 0.95 },
  Na: { name: n('鈉', 'Sodium', 'ナトリウム'), color: '#d07a3a', displayRadius: 0.5 },
  C: { name: n('碳', 'Carbon', '炭素'), color: '#8a9099', displayRadius: 0.35 },
  Zn: { name: n('鋅', 'Zinc', '亜鉛'), color: '#a9b6dc', displayRadius: 0.42 },
  S: { name: n('硫', 'Sulfur', '硫黄'), color: '#e3bf32', displayRadius: 0.9 },
  Ba: { name: n('鋇', 'Barium', 'バリウム'), color: '#8a7cc8', displayRadius: 0.85 },
  Ti: { name: n('鈦', 'Titanium', 'チタン'), color: '#1f9a6a', displayRadius: 0.32 },
  O: { name: n('氧', 'Oxygen', '酸素'), color: '#e2733a', displayRadius: 0.7 },
}

export function elementStyle(symbol: string): ElementStyle {
  return ELEMENTS[symbol] ?? { name: n(symbol, symbol, symbol), color: '#888888', displayRadius: 0.4 }
}
