import { centeringTranslations, type Centering } from './centering'
import { BOUNDARY_EPS, LATTICE_POINT_ID, wrapPosition } from './periodic'
import type { AtomImage, BasisAtom, LatticeBasis, Vec3 } from './types'

/**
 * 六方柱（hexagonal prism）由 3 個六方晶胞組成，底面中心位於原點。
 * 以分率座標表示，六角形頂點為 ±a⃗、±b⃗、±(a⃗+b⃗)，區域條件為 |x| ≤ 1、|y| ≤ 1、|x − y| ≤ 1。
 * 前提：γ = 120° 的六方晶胞設定。
 */
export const HEX_VERTICES: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
]

export function isInsideHexPrism([x, y, z]: Vec3, layers: number): boolean {
  const e = BOUNDARY_EPS
  return Math.abs(x) <= 1 + e && Math.abs(y) <= 1 + e && Math.abs(x - y) <= 1 + e && z >= -e && z <= layers + e
}

/** 六方柱內的所有原子（含柱面與頂底面上的原子，皆以實心顯示，屬於整個六方柱的外形）。 */
export function generatePrismImages(atoms: readonly BasisAtom[], layers: number, centering: Centering = 'P'): AtomImage[] {
  const images: AtomImage[] = []
  for (const atom of atoms) {
    const f = atom.fractionalPosition
    for (const { vector: t, kind } of centeringTranslations(centering)) {
      const pos = wrapPosition([f[0] + t[0], f[1] + t[1], f[2] + t[2]])
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (let k = 0; k <= layers; k++) {
            const p: Vec3 = [pos[0] + i, pos[1] + j, pos[2] + k]
            if (!isInsideHexPrism(p, layers)) continue
            images.push({
              baseId: atom.id,
              kind,
              offset: [i, j, k],
              fractionalPosition: p,
              latticePoint: [p[0] - f[0], p[1] - f[1], p[2] - f[2]],
              isBoundaryImage: false,
            })
          }
        }
      }
    }
  }
  return images
}

/** 六方柱內的晶格點（與原子分開），對應 periodic.generateLatticePoints。 */
export function generatePrismLatticePoints(layers: number, centering: Centering = 'P'): AtomImage[] {
  return generatePrismImages([{ id: LATTICE_POINT_ID, element: '', fractionalPosition: [0, 0, 0] }], layers, centering)
}

/** 六方柱邊線（分率座標）：頂底六角形、6 條柱邊，以及把六角形分成 3 個晶胞的分隔線。 */
export function hexPrismEdges(layers: number): { outline: [Vec3, Vec3][]; cellDividers: [Vec3, Vec3][] } {
  const outline: [Vec3, Vec3][] = []
  const cellDividers: [Vec3, Vec3][] = []
  for (let n = 0; n < 6; n++) {
    const [x0, y0] = HEX_VERTICES[n]
    const [x1, y1] = HEX_VERTICES[(n + 1) % 6]
    for (const z of [0, layers]) outline.push([[x0, y0, z], [x1, y1, z]])
    outline.push([[x0, y0, 0], [x0, y0, layers]])
  }
  // 三個晶胞的共用邊：中心到 a⃗、b⃗、−(a⃗+b⃗) 方向的頂點，以及中心柱
  for (const [x, y] of [[1, 0], [0, 1], [-1, -1]] as [number, number][]) {
    for (let z = 0; z <= layers; z++) cellDividers.push([[0, 0, z], [x, y, z]])
  }
  cellDividers.push([[0, 0, 0], [0, 0, layers]])
  return { outline, cellDividers }
}

/** 四軸座標系：a₁、a₂、a₃ 位於水平面、彼此夾 120°，a₃ = −(a₁ + a₂)；c 垂直於此平面。 */
export function hexagonalAxes(basis: LatticeBasis): { a1: Vec3; a2: Vec3; a3: Vec3; c: Vec3 } {
  const { a, b, c } = basis
  return { a1: a, a2: b, a3: [-(a[0] + b[0]), -(a[1] + b[1]), -(a[2] + b[2])], c }
}

/** 三指數晶向 [UVW] → 四指數 [uvtw]：u = (2U − V)/3、v = (2V − U)/3、t = −(u + v)、w = W。 */
export function toFourIndex(U: number, V: number, W: number): [number, number, number, number] {
  const u = (2 * U - V) / 3
  const v = (2 * V - U) / 3
  return [u, v, -(u + v), W]
}

/**
 * 理想化的晶體外形：六方柱＋上下六方錐（如石英晶體的常見外形）。
 * 純幾何示意，包住 layers 層高的六方柱，柱面朝向與晶格的 a⃗ 方向對齊。
 */
export function hexagonalHabit(
  basis: LatticeBasis,
  layers: number,
): { vertices: Vec3[]; faces: [number, number, number][]; edges: [Vec3, Vec3][] } {
  const radius = Math.hypot(...basis.a) * 1.18
  const height = basis.c[2] * layers
  const margin = radius * 0.12
  const apex = radius * 1.1
  const ring = (z: number): Vec3[] =>
    HEX_VERTICES.map(([x, y]) => {
      const vx = x * basis.a[0] + y * basis.b[0]
      const vy = x * basis.a[1] + y * basis.b[1]
      const s = radius / Math.hypot(vx, vy)
      return [vx * s, vy * s, z]
    })
  const bottom = ring(-margin)
  const top = ring(height + margin)
  const vertices: Vec3[] = [...bottom, ...top, [0, 0, height + margin + apex], [0, 0, -margin - apex]]
  const faces: [number, number, number][] = []
  const edges: [Vec3, Vec3][] = []
  for (let i = 0; i < 6; i++) {
    const n = (i + 1) % 6
    faces.push([i, n, 6 + n], [i, 6 + n, 6 + i], [6 + i, 6 + n, 12], [n, i, 13])
    edges.push([bottom[i], bottom[n]], [top[i], top[n]], [bottom[i], top[i]], [top[i], vertices[12]], [bottom[i], vertices[13]])
  }
  return { vertices, faces, edges }
}

/** 兩個水平向量之間的角度弧（位於 z = 0 平面），用於標示 120°。 */
export function angleArc(from: Vec3, to: Vec3, radius: number, segments = 24): Vec3[] {
  const a0 = Math.atan2(from[1], from[0])
  let delta = Math.atan2(to[1], to[0]) - a0
  if (delta <= 0) delta += 2 * Math.PI
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = a0 + (delta * i) / segments
    return [radius * Math.cos(t), radius * Math.sin(t), 0] as Vec3
  })
}
