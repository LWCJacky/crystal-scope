import type { Vec3 } from '../core/types'

const UNICODE_FRACTIONS: Record<string, string> = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/3': '⅓', '2/3': '⅔' }
const DENOMINATORS = [1, 2, 3, 4, 6, 8]

/** 將常見分數以分數形式顯示（0.5 → ½），其餘保留 4 位小數。 */
export function formatFraction(value: number): string {
  const sign = value < 0 ? '−' : ''
  const v = Math.abs(value)
  for (const d of DENOMINATORS) {
    const n = Math.round(v * d)
    if (Math.abs(v * d - n) < 1e-6) {
      if (d === 1) return `${sign}${n}`
      return sign + (UNICODE_FRACTIONS[`${n}/${d}`] ?? `${n}/${d}`)
    }
  }
  return sign + v.toFixed(4).replace(/0+$/, '')
}

export function formatPosition(p: Vec3): string {
  return `(${p.map(formatFraction).join(', ')})`
}
