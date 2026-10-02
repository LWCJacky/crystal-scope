import { assemblyDuration, piecePose, pieceCount, REVEAL_DURATION, type AssemblyMode, type PiecePose } from './assembly'
import { easeOut } from './easing'

/**
 * 點選範例時自動播放的演示：
 * - assembly：六方柱拼裝（先合併各塊，再顯示完整結構）。
 * - build：建構動畫，依「晶胞邊線 → 晶格點 → 基元原子 → 鍵」呈現 Structure = Lattice + Motif。
 */
export type DemoKind = 'assembly' | 'build' | 'ladder'

/** 演示在某一時刻的狀態；渲染層只依此設定不透明度與各塊姿態。 */
export interface DemoState {
  poses: PiecePose[]
  /** 原子層（由下往上）的不透明度。 */
  atomLayers: number[]
  /** 晶格點層（由下往上）的不透明度。 */
  latticeLayers: number[]
  /** 拼裝各塊色塊的不透明度倍率。 */
  faces: number
  bonds: number
  edges: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** 在 [start, start + span] 內讓 n 層依序淡入，每層 fade 秒。 */
function layered(time: number, n: number, start: number, span: number, fade: number): number[] {
  const step = n > 1 ? (span - fade) / (n - 1) : 0
  return Array.from({ length: n }, (_, i) => easeOut(clamp01((time - start - i * step) / fade)))
}

/** 建構動畫時間軸（秒，1× 速度）。 */
const BUILD = {
  edges: { start: 0, fade: 0.5 },
  lattice: { start: 0.3, span: 1.0, fade: 0.4 },
  atoms: { start: 1.4, span: 1.3, fade: 0.5 },
  /** 原子出現後晶格點淡出，讓畫面回到結構本身。 */
  latticeOut: { start: 1.6, fade: 1.0 },
  bonds: { start: 2.6, fade: 0.4 },
}

export function demoDuration(kind: DemoKind, mode: AssemblyMode): number {
  // 尺度之旅的長度依剖面（多晶／單晶）而定，由 useDemo 以 ladderSeconds 計算
  if (kind === 'ladder') return 0
  return kind === 'assembly' ? assemblyDuration(mode) + REVEAL_DURATION : BUILD.bonds.start + BUILD.bonds.fade
}

export function demoState(
  kind: DemoKind,
  mode: AssemblyMode,
  time: number,
  counts: { atomLayers: number; latticeLayers: number },
  reduced = false,
): DemoState {
  if (kind === 'assembly') {
    const start = assemblyDuration(mode)
    const bondStart = start + REVEAL_DURATION - 0.4
    return {
      poses: Array.from({ length: pieceCount(mode) }, (_, k) => piecePose(k, mode, time, reduced)),
      atomLayers: layered(time, counts.atomLayers, start, REVEAL_DURATION - 0.4, 0.5),
      latticeLayers: layered(time, counts.latticeLayers, start, REVEAL_DURATION - 0.4, 0.5),
      faces: 1 - easeOut(clamp01((time - start) / 0.6)),
      bonds: easeOut(clamp01((time - bondStart) / 0.4)),
      edges: 1,
    }
  }
  const hasAtoms = counts.atomLayers > 0
  // 只有晶格點時（晶格點視圖），晶格點保留不淡出
  const latticeKeep = hasAtoms ? 1 - easeOut(clamp01((time - BUILD.latticeOut.start) / BUILD.latticeOut.fade)) : 1
  return {
    poses: [],
    atomLayers: layered(time, counts.atomLayers, BUILD.atoms.start, BUILD.atoms.span, BUILD.atoms.fade),
    latticeLayers: layered(time, counts.latticeLayers, BUILD.lattice.start, BUILD.lattice.span, BUILD.lattice.fade).map(
      (o) => o * latticeKeep,
    ),
    faces: 0,
    bonds: easeOut(clamp01((time - BUILD.bonds.start) / BUILD.bonds.fade)),
    edges: easeOut(clamp01((time - BUILD.edges.start) / BUILD.edges.fade)),
  }
}
