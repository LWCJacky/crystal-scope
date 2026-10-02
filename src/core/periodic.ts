import type { AtomImage, BasisAtom, RepeatSettings, Vec3 } from './types'

/** 視為落在晶胞邊界上的容差。 */
export const BOUNDARY_EPS = 1e-6

export const MIN_REPEAT = 1
export const MAX_REPEAT = 5

/** 依週期折返至 [0,1)，並把貼近 1 的值與 −0 正規化為 0，避免邊界重複計數。 */
export function wrapFraction(x: number): number {
  let w = x - Math.floor(x)
  if (w > 1 - BOUNDARY_EPS || Math.abs(w) < BOUNDARY_EPS) w = 0
  return w
}

export function wrapPosition([x, y, z]: Vec3): Vec3 {
  return [wrapFraction(x), wrapFraction(y), wrapFraction(z)]
}

export function clampRepeat(n: number): number {
  return Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Math.round(n)))
}

/**
 * 依週期設定產生所有視覺複本：(x+i, y+j, z+k)，i ∈ [0, Na) …
 * 座標為 0 的原子另在 N 位置產生邊界複本（isBoundaryImage），僅供顯示、不計數。
 */
export function generateImages(atoms: readonly BasisAtom[], repeat: RepeatSettings): AtomImage[] {
  const counts: Vec3 = [clampRepeat(repeat.repeatA), clampRepeat(repeat.repeatB), clampRepeat(repeat.repeatC)]
  const images: AtomImage[] = []

  for (const atom of atoms) {
    const pos = wrapPosition(atom.fractionalPosition)
    const ranges = pos.map((p, axis) => {
      const n = counts[axis]
      const offsets = Array.from({ length: n }, (_, i) => i)
      if (repeat.showBoundaryImages && p === 0) offsets.push(n)
      return offsets
    })

    for (const i of ranges[0]) {
      for (const j of ranges[1]) {
        for (const k of ranges[2]) {
          images.push({
            baseId: atom.id,
            offset: [i, j, k],
            fractionalPosition: [pos[0] + i, pos[1] + j, pos[2] + k],
            isBoundaryImage: i === counts[0] || j === counts[1] || k === counts[2],
          })
        }
      }
    }
  }
  return images
}

/** 晶格點（與原子分開）：0…N 的整數組合，含外側邊界。 */
export function generateLatticePoints(repeat: RepeatSettings): Vec3[] {
  const points: Vec3[] = []
  const [na, nb, nc] = [clampRepeat(repeat.repeatA), clampRepeat(repeat.repeatB), clampRepeat(repeat.repeatC)]
  for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) for (let k = 0; k <= nc; k++) points.push([i, j, k])
  return points
}

/** 晶胞邊線端點對（分率座標），涵蓋整個 Na×Nb×Nc 區塊內所有晶胞邊。 */
export function generateCellEdges(repeat: RepeatSettings): [Vec3, Vec3][] {
  const n: Vec3 = [clampRepeat(repeat.repeatA), clampRepeat(repeat.repeatB), clampRepeat(repeat.repeatC)]
  const edges: [Vec3, Vec3][] = []
  for (let axis = 0; axis < 3; axis++) {
    const [p, q] = [(axis + 1) % 3, (axis + 2) % 3]
    for (let s = 0; s <= n[p]; s++) {
      for (let t = 0; t <= n[q]; t++) {
        const start: Vec3 = [0, 0, 0]
        start[p] = s
        start[q] = t
        const end: Vec3 = [...start]
        end[axis] = n[axis]
        edges.push([start, end])
      }
    }
  }
  return edges
}
