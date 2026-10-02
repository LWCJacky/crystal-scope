export interface ElementStyle {
  nameZh: string
  color: string
  /** 示意顯示半徑（Å）；僅供辨識相對大小，非真實離子或原子半徑。 */
  displayRadius: number
}

/** 元素配色沿用課程投影片的慣例，並確保在淺色與深色背景都可辨識。 */
export const ELEMENTS: Record<string, ElementStyle> = {
  X: { nameZh: '示意原子', color: '#4f7fe0', displayRadius: 0.12 },
  Fe: { nameZh: '鐵', color: '#5b7fd6', displayRadius: 0.5 },
  Cu: { nameZh: '銅', color: '#3fa58f', displayRadius: 0.5 },
  Mg: { nameZh: '鎂', color: '#9aa3ad', displayRadius: 0.55 },
  U: { nameZh: '鈾', color: '#4a5be0', displayRadius: 0.5 },
  Cs: { nameZh: '銫', color: '#8f9fe6', displayRadius: 0.85 },
  Cl: { nameZh: '氯', color: '#2e9a5c', displayRadius: 0.95 },
  Na: { nameZh: '鈉', color: '#d07a3a', displayRadius: 0.5 },
  C: { nameZh: '碳', color: '#8a9099', displayRadius: 0.35 },
  Zn: { nameZh: '鋅', color: '#a9b6dc', displayRadius: 0.42 },
  S: { nameZh: '硫', color: '#e3bf32', displayRadius: 0.9 },
  Ba: { nameZh: '鋇', color: '#8a7cc8', displayRadius: 0.85 },
  Ti: { nameZh: '鈦', color: '#1f9a6a', displayRadius: 0.32 },
  O: { nameZh: '氧', color: '#e2733a', displayRadius: 0.7 },
}

export function elementStyle(symbol: string): ElementStyle {
  return ELEMENTS[symbol] ?? { nameZh: symbol, color: '#888888', displayRadius: 0.4 }
}
