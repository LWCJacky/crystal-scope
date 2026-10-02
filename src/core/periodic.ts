import { centeringTranslations, type Centering } from './centering'
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
 * 依週期設定與心型產生所有視覺複本：(x+tx+i, y+ty+j, z+tz+k)，i ∈ [0, Na) …
 * 其中 t 為心型平移（P 只有原點）。複本以 kind 標記來自哪一種晶格點。
 * 座標為 0 的位置另在 N 產生邊界複本（isBoundaryImage），僅供顯示、不計數。
 */
export function generateImages(
  atoms: readonly BasisAtom[],
  repeat: RepeatSettings,
  centering: Centering = 'P',
  /** 區塊外側額外包含的晶胞層數；供「裁切至晶胞」把從外側侵入的球體也納入裁切。 */
  margin = 0,
): AtomImage[] {
  const counts: Vec3 = [clampRepeat(repeat.repeatA), clampRepeat(repeat.repeatB), clampRepeat(repeat.repeatC)]
  const images: AtomImage[] = []

  for (const atom of atoms) {
    for (const { vector: t, kind } of centeringTranslations(centering)) {
      const f = atom.fractionalPosition
      const pos = wrapPosition([f[0] + t[0], f[1] + t[1], f[2] + t[2]])
      const ranges = pos.map((p, axis) => {
        const n = counts[axis]
        if (margin > 0) return Array.from({ length: n + 2 * margin }, (_, i) => i - margin)
        const offsets = Array.from({ length: n }, (_, i) => i)
        if (repeat.showBoundaryImages && p === 0) offsets.push(n)
        return offsets
      })

      for (const i of ranges[0]) {
        for (const j of ranges[1]) {
          for (const k of ranges[2]) {
            const fractionalPosition: Vec3 = [pos[0] + i, pos[1] + j, pos[2] + k]
            images.push({
              baseId: atom.id,
              kind,
              offset: [i, j, k],
              fractionalPosition,
              // 此原子所關聯的晶格點 = 原子位置 − 基元內座標（折返後仍指向正確的晶格點）
              latticePoint: [fractionalPosition[0] - f[0], fractionalPosition[1] - f[1], fractionalPosition[2] - f[2]],
              isBoundaryImage:
                i < 0 || j < 0 || k < 0 || i >= counts[0] || j >= counts[1] || k >= counts[2]
                  ? // 邊界上（p = 0 且位於 N）的複本與區塊外的複本皆標為邊界複本
                    true
                  : false,
            })
          }
        }
      }
    }
  }
  return images
}

/** 晶格點視圖用的虛擬基底：原點一個晶格點（晶格點不必然是原子）。 */
export const LATTICE_POINT_ID = 'lattice-point'

/** 晶格點（與原子分開）：原點晶格點經心型平移與週期複製，含外側邊界複本。 */
export function generateLatticePoints(repeat: RepeatSettings, centering: Centering = 'P'): AtomImage[] {
  return generateImages([{ id: LATTICE_POINT_ID, element: '', fractionalPosition: [0, 0, 0] }], repeat, centering)
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
