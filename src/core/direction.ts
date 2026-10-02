import type { LatticeBasis, Vec3 } from './types'

export type DirectionValidation = { valid: true } | { valid: false; reason: string }

export function validateIndices(u: number, v: number, w: number): DirectionValidation {
  if (![u, v, w].every(Number.isInteger)) return { valid: false, reason: 'Direction indices must be integers' }
  if (u === 0 && v === 0 && w === 0) return { valid: false, reason: '[000] does not define a direction' }
  return { valid: true }
}

/** d⃗ = u·a⃗ + v·b⃗ + w·c⃗（與起點無關）。 */
export function directionVector(basis: LatticeBasis, u: number, v: number, w: number): Vec3 {
  return [
    u * basis.a[0] + v * basis.b[0] + w * basis.c[0],
    u * basis.a[1] + v * basis.b[1] + w * basis.c[1],
    u * basis.a[2] + v * basis.b[2] + w * basis.c[2],
  ]
}

function gcd(x: number, y: number): number {
  x = Math.abs(x)
  y = Math.abs(y)
  while (y) [x, y] = [y, x % y]
  return x
}

/** 化為最簡整數比，例如 [2 2 0] → [1 1 0]。 */
export function reduceIndices(u: number, v: number, w: number): Vec3 {
  const g = gcd(gcd(u, v), w) || 1
  return [u / g, v / g, w / g]
}

/** 以晶體學記法顯示，負號以上橫線表示：[1 −1 0] → [11̄0]。 */
export function formatIndices(u: number, v: number, w: number): string {
  const fmt = (n: number) => (n < 0 ? `${-n}̄` : `${n}`)
  return `[${fmt(u)}${fmt(v)}${fmt(w)}]`
}
