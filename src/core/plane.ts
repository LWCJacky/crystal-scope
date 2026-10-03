import { fracToCart } from './lattice'
import type { LatticeBasis, Vec3 } from './types'

/**
 * 晶面 (hkl)：以倒晶格定義（統一不用 2π）。
 *   a* = (b × c)/V、b* = (c × a)/V、c* = (a × b)/V，g = h a* + k b* + l c*
 *   平面族：g · r = m（分率座標：h x + k y + l z = m）；單位法向 = g/|g|；相鄰整數 m 平面間距 = 1/|g|。
 * 任意非正交晶格不可把 (h,k,l) 當成直角座標法向量，也不可假設 [hkl] 垂直 (hkl)。
 * 這裡的間距是幾何上的平面序列間距；心型晶格的占點平面與繞射消光屬另一層問題。
 */
export type MillerValidation = { valid: true } | { valid: false; reason: string }

export function validateMiller(h: number, k: number, l: number): MillerValidation {
  if (![h, k, l].every(Number.isInteger)) return { valid: false, reason: 'Miller indices must be integers' }
  if (h === 0 && k === 0 && l === 0) return { valid: false, reason: '(000) does not define a plane' }
  return { valid: true }
}

const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
const scale = (p: Vec3, s: number): Vec3 => [p[0] * s, p[1] * s, p[2] * s]
const add = (p: Vec3, q: Vec3): Vec3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]
const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const norm = (p: Vec3) => Math.hypot(p[0], p[1], p[2])

export interface ReciprocalBasis {
  a: Vec3
  b: Vec3
  c: Vec3
}

/** 倒晶格基底（無 2π）。 */
export function reciprocalBasis(basis: LatticeBasis): ReciprocalBasis {
  const V = dot(basis.a, cross(basis.b, basis.c))
  return {
    a: scale(cross(basis.b, basis.c), 1 / V),
    b: scale(cross(basis.c, basis.a), 1 / V),
    c: scale(cross(basis.a, basis.b), 1 / V),
  }
}

export interface PlaneGeometry {
  /** 倒晶格向量 g（直角座標）。 */
  g: Vec3
  unitNormal: Vec3
  /** 相鄰整數 m 平面的間距 1/|g|。 */
  spacing: number
}

export function planeGeometry(basis: LatticeBasis, h: number, k: number, l: number): PlaneGeometry {
  const r = reciprocalBasis(basis)
  const g = add(add(scale(r.a, h), scale(r.b, k)), scale(r.c, l))
  const len = norm(g)
  return { g, unitNormal: scale(g, 1 / len), spacing: 1 / len }
}

export interface FractionalBox {
  min: Vec3
  max: Vec3
}

/**
 * 平面 g·r = m + shift·|g|（shift 為沿法向的物理距離，與序號 m 分開）與展示區平行六面體的截面：
 * 取平面與 12 條邊的交點、去重、依繞質心的角度排序，回傳可直接扇形三角化的多邊形（直角座標）。
 * 沒有交集回傳空陣列。
 */
export function planePolygon(basis: LatticeBasis, h: number, k: number, l: number, m: number, shift: number, box: FractionalBox): Vec3[] {
  if (!validateMiller(h, k, l).valid) return []
  const { g, unitNormal } = planeGeometry(basis, h, k, l)
  const c = m + shift * norm(g)
  const corners: Vec3[] = []
  for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) corners.push(fracToCart(basis, [x, y, z]))
  // 以位元差表示相鄰角點：索引 (x,y,z) = (4,2,1) 位元
  const edges: [number, number][] = []
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) edges.push([i, i | bit])
  const size = Math.max(...corners.map(norm), 1)
  const eps = 1e-9 * size
  const points: Vec3[] = []
  const pushUnique = (p: Vec3) => {
    if (!points.some((q) => norm(sub(p, q)) < 1e-7 * size)) points.push(p)
  }
  for (const [i, j] of edges) {
    const P = corners[i]
    const Q = corners[j]
    const fP = dot(g, P) - c
    const fQ = dot(g, Q) - c
    if (Math.abs(fP) < eps) pushUnique(P)
    if (Math.abs(fQ) < eps) pushUnique(Q)
    if (fP * fQ < 0 && Math.abs(fP) >= eps && Math.abs(fQ) >= eps) {
      const t = fP / (fP - fQ)
      pushUnique(add(P, scale(sub(Q, P), t)))
    }
  }
  if (points.length < 3) return []
  const centroid = scale(points.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / points.length)
  const u0 = sub(points[0], centroid)
  const u = scale(u0, 1 / (norm(u0) || 1))
  const v = cross(unitNormal, u)
  return points
    .map((p) => ({ p, angle: Math.atan2(dot(sub(p, centroid), v), dot(sub(p, centroid), u)) }))
    .sort((a, b) => a.angle - b.angle)
    .map((x) => x.p)
}

/** 以晶體學記法顯示，負號以上橫線表示：(1 −1 0) → (11̄0)。 */
export function formatMiller(h: number, k: number, l: number): string {
  const fmt = (n: number) => (n < 0 ? `${-n}̄` : `${n}`)
  return `(${fmt(h)}${fmt(k)}${fmt(l)})`
}

/** 六方晶系的四指數晶面 (h k i l)，i = −(h + k)。 */
export function fourIndexPlane(h: number, k: number, l: number): [number, number, number, number] {
  return [h, k, -(h + k), l]
}
