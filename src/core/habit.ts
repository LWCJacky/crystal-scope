import type { LatticeBasis, Vec3 } from './types'

/** 實心多面體：頂點、三角面、稜線。 */
export interface Polyhedron {
  vertices: Vec3[]
  faces: [number, number, number][]
  edges: [Vec3, Vec3][]
}

/** 以頂點與各面的頂點索引（逆時針）建立多面體，自動三角化並收集稜線。 */
function fromFaces(vertices: Vec3[], polygons: number[][]): Polyhedron {
  const faces: [number, number, number][] = []
  const edgeKeys = new Set<string>()
  const edges: [Vec3, Vec3][] = []
  for (const poly of polygons) {
    for (let i = 1; i < poly.length - 1; i++) faces.push([poly[0], poly[i], poly[i + 1]])
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      edges.push([vertices[a], vertices[b]])
    }
  }
  return { vertices, faces, edges }
}

/** 立方體外形（岩鹽、CsCl 等常見晶癖），中心在原點。 */
export function cubeHabit(size: number): Polyhedron {
  const h = size / 2
  const v: Vec3[] = [
    [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
    [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
  ]
  return fromFaces(v, [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ])
}

/** 正八面體外形（鑽石常見晶癖），中心在原點。 */
export function octahedronHabit(size: number): Polyhedron {
  const h = size / 2
  const v: Vec3[] = [[h, 0, 0], [-h, 0, 0], [0, h, 0], [0, -h, 0], [0, 0, h], [0, 0, -h]]
  return fromFaces(v, [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ])
}

/** 與晶胞同形的平行六面體（示意晶系的巨觀「單晶」），中心在原點。 */
export function parallelepipedHabit(basis: LatticeBasis, scale: number): Polyhedron {
  const { a, b, c } = basis
  const corner = (x: number, y: number, z: number): Vec3 => [
    ((x - 0.5) * a[0] + (y - 0.5) * b[0] + (z - 0.5) * c[0]) * scale,
    ((x - 0.5) * a[1] + (y - 0.5) * b[1] + (z - 0.5) * c[1]) * scale,
    ((x - 0.5) * a[2] + (y - 0.5) * b[2] + (z - 0.5) * c[2]) * scale,
  ]
  const v = [
    corner(0, 0, 0), corner(1, 0, 0), corner(1, 1, 0), corner(0, 1, 0),
    corner(0, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(0, 1, 1),
  ]
  return fromFaces(v, [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ])
}

/** 多面體的最大範圍（任兩頂點的最大距離），用於換算巨觀尺寸。 */
export function polyhedronExtent(p: Polyhedron): number {
  let max = 0
  for (const u of p.vertices) for (const w of p.vertices) max = Math.max(max, Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]))
  return max
}
