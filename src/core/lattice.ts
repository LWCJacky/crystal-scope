import type { CellParams, LatticeBasis, Vec3 } from './types'

const DEG = Math.PI / 180
/** 體積因子平方的下限；低於此值視為退化（共面）晶胞。 */
const MIN_VOLUME_FACTOR_SQ = 1e-6

export type CellValidation = { valid: true } | { valid: false; reason: string }

/** V / (abc) 的平方：1 − cos²α − cos²β − cos²γ + 2 cosα cosβ cosγ */
function volumeFactorSq({ alpha, beta, gamma }: CellParams): number {
  const ca = Math.cos(alpha * DEG)
  const cb = Math.cos(beta * DEG)
  const cg = Math.cos(gamma * DEG)
  return 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg
}

export function validateCell(cell: CellParams): CellValidation {
  const { a, b, c, alpha, beta, gamma } = cell
  for (const [name, v] of [['a', a], ['b', b], ['c', c]] as const) {
    if (!Number.isFinite(v) || v <= 0) return { valid: false, reason: `邊長 ${name} 必須大於 0` }
  }
  for (const [name, v] of [['α', alpha], ['β', beta], ['γ', gamma]] as const) {
    if (!Number.isFinite(v) || v <= 0 || v >= 180) {
      return { valid: false, reason: `夾角 ${name} 必須介於 0° 與 180° 之間` }
    }
  }
  if (volumeFactorSq(cell) <= MIN_VOLUME_FACTOR_SQ) {
    return { valid: false, reason: '此角度組合無法形成有效的三維晶胞（體積為零或為負）' }
  }
  return { valid: true }
}

/** 以 a⃗ 沿 x 軸、b⃗ 位於 xy 平面的慣例建立晶格基底。呼叫前應先通過 validateCell。 */
export function cellToBasis(cell: CellParams): LatticeBasis {
  const { a, b, c } = cell
  const ca = Math.cos(cell.alpha * DEG)
  const cb = Math.cos(cell.beta * DEG)
  const cg = Math.cos(cell.gamma * DEG)
  const sg = Math.sin(cell.gamma * DEG)
  return {
    a: [a, 0, 0],
    b: [b * cg, b * sg, 0],
    c: [c * cb, (c * (ca - cb * cg)) / sg, (c * Math.sqrt(volumeFactorSq(cell))) / sg],
  }
}

export function cellVolume(cell: CellParams): number {
  return cell.a * cell.b * cell.c * Math.sqrt(volumeFactorSq(cell))
}

/** r = x·a⃗ + y·b⃗ + z·c⃗ */
export function fracToCart(basis: LatticeBasis, [x, y, z]: Vec3): Vec3 {
  return [
    x * basis.a[0] + y * basis.b[0] + z * basis.c[0],
    x * basis.a[1] + y * basis.b[1] + z * basis.c[1],
    x * basis.a[2] + y * basis.b[2] + z * basis.c[2],
  ]
}

/**
 * 直角座標 → 分率座標。利用基底為下三角形式（a⃗ 只有 x、b⃗ 無 z）逐步回代。
 * 拖曳原子時必須經由此函式換算，不可把螢幕 XYZ 位移直接當成分率座標。
 */
export function cartToFrac(basis: LatticeBasis, [px, py, pz]: Vec3): Vec3 {
  const z = pz / basis.c[2]
  const y = (py - z * basis.c[1]) / basis.b[1]
  const x = (px - y * basis.b[0] - z * basis.c[0]) / basis.a[0]
  return [x, y, z]
}

export interface ClipPlane {
  /** 單位法向量，指向保留側。 */
  normal: Vec3
  /** 保留 normal·r + constant ≥ 0 的區域（與 Three.js Plane 慣例一致）。 */
  constant: number
}

function cross(p: Vec3, q: Vec3): Vec3 {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]
}

/**
 * 分率座標區塊 0 ≤ x ≤ Na、0 ≤ y ≤ Nb、0 ≤ z ≤ Nc 的六個邊界面。
 * 每個面的法向量沿倒晶格方向（例如 b⃗ × c⃗），非正交晶胞亦正確。
 */
export function cellClipPlanes(basis: LatticeBasis, counts: Vec3): ClipPlane[] {
  const vectors = [basis.a, basis.b, basis.c]
  const planes: ClipPlane[] = []
  for (let i = 0; i < 3; i++) {
    const n = cross(vectors[(i + 1) % 3], vectors[(i + 2) % 3])
    const len = Math.hypot(...n)
    const unit: Vec3 = [n[0] / len, n[1] / len, n[2] / len]
    // a⃗ᵢ 在法向上的投影 = 相鄰兩面之間的距離
    const spacing = unit[0] * vectors[i][0] + unit[1] * vectors[i][1] + unit[2] * vectors[i][2]
    planes.push({ normal: unit, constant: 0 })
    planes.push({ normal: [-unit[0], -unit[1], -unit[2]], constant: counts[i] * spacing })
  }
  return planes
}
