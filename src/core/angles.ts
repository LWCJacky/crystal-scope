import type { LatticeBasis, Vec3 } from './types'

/** 晶胞夾角標示：α = ∠(b⃗, c⃗)、β = ∠(a⃗, c⃗)、γ = ∠(a⃗, b⃗)。 */
export interface AngleMark {
  name: 'α' | 'β' | 'γ'
  degrees: number
  /** 弧線（或直角記號）的折線點。 */
  path: Vec3[]
  /** 弧線兩端的箭頭（直角時為空）。 */
  arrowheads: [Vec3, Vec3][]
  labelPosition: Vec3
  isRightAngle: boolean
}

const RIGHT_ANGLE_TOLERANCE = 0.05 // 度
const ARROW_HALF_ANGLE = (25 * Math.PI) / 180

const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
const scale = (p: Vec3, k: number): Vec3 => [p[0] * k, p[1] * k, p[2] * k]
const add = (p: Vec3, q: Vec3): Vec3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]
const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const unit = (p: Vec3): Vec3 => scale(p, 1 / Math.hypot(...p))

/** 在 û 與 v̂ 所張平面上、半徑 r 的圓弧（球面線性插值，任意夾角皆適用）。 */
function arc(u: Vec3, v: Vec3, theta: number, r: number, segments: number): Vec3[] {
  const s = Math.sin(theta)
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments
    return scale(add(scale(u, Math.sin((1 - t) * theta) / s), scale(v, Math.sin(t * theta) / s)), r)
  })
}

/** 弧線端點的箭頭：沿切線反方向、在弧所在平面內張開 ±25°。 */
function arrowhead(tip: Vec3, before: Vec3, size: number): [Vec3, Vec3][] {
  const tangent = unit(sub(tip, before))
  const radial = unit(tip)
  return [1, -1].map((side) => {
    const wing = add(scale(tangent, -Math.cos(ARROW_HALF_ANGLE)), scale(radial, side * Math.sin(ARROW_HALF_ANGLE)))
    return [tip, add(tip, scale(wing, size))] as [Vec3, Vec3]
  })
}

function mark(name: AngleMark['name'], p: Vec3, q: Vec3, radius: number): AngleMark {
  const u = unit(p)
  const v = unit(q)
  const theta = Math.acos(Math.min(1, Math.max(-1, dot(u, v))))
  const degrees = (theta * 180) / Math.PI
  const isRightAngle = Math.abs(degrees - 90) < RIGHT_ANGLE_TOLERANCE
  const bisector = unit(add(u, v))
  if (isRightAngle) {
    // 教科書慣用的直角記號 ⌐
    const s = radius * 0.55
    return {
      name,
      degrees: 90,
      path: [scale(u, s), add(scale(u, s), scale(v, s)), scale(v, s)],
      arrowheads: [],
      labelPosition: scale(bisector, radius * 1.7),
      isRightAngle,
    }
  }
  const segments = Math.max(12, Math.round(degrees / 4))
  const path = arc(u, v, theta, radius, segments)
  const size = radius * 0.22
  return {
    name,
    degrees,
    path,
    arrowheads: [...arrowhead(path[segments], path[segments - 1], size), ...arrowhead(path[0], path[1], size)],
    labelPosition: scale(bisector, radius * 1.6),
    isRightAngle,
  }
}

export function cellAngleMarks(basis: LatticeBasis, radius: number): AngleMark[] {
  return [mark('α', basis.b, basis.c, radius), mark('β', basis.a, basis.c, radius), mark('γ', basis.a, basis.b, radius)]
}

/** 角度文字：整數不顯示小數，例如 120°、104.5°。 */
export function formatDegrees(deg: number): string {
  const r = Math.round(deg * 10) / 10
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}°`
}
