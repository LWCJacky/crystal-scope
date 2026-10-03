import type { RepeatSettings, Vec3 } from './types'

export type EdgeLayer = 'cell' | 'grid' | 'frame'

export interface GridLayers {
  /** 原點那一個晶胞的 12 條邊（分率座標）。 */
  cell: [Vec3, Vec3][]
  /** 區塊內的重複晶胞格線（含表面上的格線），不含外框。 */
  grid: [Vec3, Vec3][]
  /** Na×Nb×Nc 區塊的 12 條外框線。 */
  frame: [Vec3, Vec3][]
  /** 1×1×1 時外框與主晶胞完全重合：主晶胞可見時外框不畫，避免閃爍。 */
  frameDuplicatesCell: boolean
}

/** 單位晶胞的 12 條邊。 */
export function unitCellEdges(): [Vec3, Vec3][] {
  const edges: [Vec3, Vec3][] = []
  for (let axis = 0; axis < 3; axis++) {
    const [p, q] = [(axis + 1) % 3, (axis + 2) % 3]
    for (const s of [0, 1]) {
      for (const t of [0, 1]) {
        const start: Vec3 = [0, 0, 0]
        start[p] = s
        start[q] = t
        const end: Vec3 = [...start]
        end[axis] = 1
        edges.push([start, end])
      }
    }
  }
  return edges
}

/**
 * 三層格線：主晶胞、重複晶胞格線、超晶胞外框，分別可開關與著色。
 * 與主晶胞邊重合的格線／外框線段只保留 [1, n] 的部分（共用邊去重，避免深度衝突）；
 * 1×1×1 時外框與主晶胞相同，改以 frameDuplicatesCell 交由顯示層決定優先權。
 */
export function gridLayers(repeat: Pick<RepeatSettings, 'repeatA' | 'repeatB' | 'repeatC'>): GridLayers {
  const n: Vec3 = [Math.max(1, Math.round(repeat.repeatA)), Math.max(1, Math.round(repeat.repeatB)), Math.max(1, Math.round(repeat.repeatC))]
  const unit = n.every((v) => v === 1)
  const grid: [Vec3, Vec3][] = []
  const frame: [Vec3, Vec3][] = []
  for (let axis = 0; axis < 3; axis++) {
    const [p, q] = [(axis + 1) % 3, (axis + 2) % 3]
    for (let s = 0; s <= n[p]; s++) {
      for (let t = 0; t <= n[q]; t++) {
        const onFrame = (s === 0 || s === n[p]) && (t === 0 || t === n[q])
        const coincidesWithCell = s <= 1 && t <= 1
        const start: Vec3 = [0, 0, 0]
        start[p] = s
        start[q] = t
        // 與主晶胞邊重合的線段從 1 開始；n = 1 時整條都與主晶胞重合
        if (coincidesWithCell) {
          if (n[axis] === 1) {
            if (onFrame && unit) frame.push([start, (() => { const e: Vec3 = [...start]; e[axis] = 1; return e })()])
            continue
          }
          start[axis] = 1
        }
        const end: Vec3 = [...start]
        end[axis] = n[axis]
        ;(onFrame ? frame : grid).push([start, end])
      }
    }
  }
  return { cell: unitCellEdges(), grid, frame, frameDuplicatesCell: unit }
}
