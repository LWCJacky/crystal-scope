import { easeInOut, easeOut } from './easing'
import { HEX_VERTICES } from './hexagonal'
import type { Vec3 } from './types'

/**
 * 六方柱拼裝：
 * - wedge6：6 個三角柱，每塊為六角形的 1/6（幾何切塊，不是晶胞；2 塊 = 1 個晶胞）。
 * - cell3：3 個六方晶胞（菱形柱），每塊相差 120°。
 * 第一階段只合併各塊的實心形狀；原子不隨塊移動，而是在合併完成後由下往上逐層顯示（見 demo.ts）。
 */
export type AssemblyMode = 'wedge6' | 'cell3'

export const pieceCount = (mode: AssemblyMode) => (mode === 'wedge6' ? 6 : 3)
const pieceStep = (mode: AssemblyMode) => (2 * Math.PI) / pieceCount(mode)

/** 第 k 塊的外框邊線（分率座標），底面與頂面多邊形＋柱邊。 */
export function pieceOutline(k: number, mode: AssemblyMode, layers: number): [Vec3, Vec3][] {
  const v = (i: number) => HEX_VERTICES[i % 6]
  const polygon: [number, number][] =
    mode === 'wedge6' ? [[0, 0], v(k), v(k + 1)] : [[0, 0], v(2 * k), v(2 * k + 1), v(2 * k + 2)]
  const edges: [Vec3, Vec3][] = []
  polygon.forEach(([x, y], i) => {
    const [nx, ny] = polygon[(i + 1) % polygon.length]
    edges.push([[x, y, 0], [nx, ny, 0]], [[x, y, layers], [nx, ny, layers]], [[x, y, 0], [x, y, layers]])
  })
  return edges
}

/** 第 k 塊的實心柱體（分率座標頂點＋三角面），合併階段以半透明色塊呈現。 */
export function pieceSolid(k: number, mode: AssemblyMode, layers: number): { vertices: Vec3[]; faces: [number, number, number][] } {
  const v = (i: number) => HEX_VERTICES[i % 6]
  const polygon: [number, number][] =
    mode === 'wedge6' ? [[0, 0], v(k), v(k + 1)] : [[0, 0], v(2 * k), v(2 * k + 1), v(2 * k + 2)]
  const n = polygon.length
  const vertices: Vec3[] = [...polygon.map(([x, y]) => [x, y, 0] as Vec3), ...polygon.map(([x, y]) => [x, y, layers] as Vec3)]
  const faces: [number, number, number][] = []
  for (let i = 1; i < n - 1; i++) faces.push([0, i + 1, i], [n, n + i, n + i + 1])
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    faces.push([i, j, n + j], [i, n + j, n + i])
  }
  return { vertices, faces }
}

/** 第 k 塊中心線的方位角（徑向飛入方向）。 */
export const pieceCentroidAngle = (k: number, mode: AssemblyMode) => (k + 0.5) * pieceStep(mode)

/** 時間軸（秒，1× 速度）：每塊 PIECE_DURATION，相鄰塊錯開 STAGGER。說明型動畫，可長於一般 UI。 */
export const PIECE_DURATION = 1.6
export const STAGGER = 0.9

/** 合併階段結束的時間。 */
export function assemblyDuration(mode: AssemblyMode): number {
  return (pieceCount(mode) - 1) * STAGGER + PIECE_DURATION
}

/** 第二階段：合併完成後顯示完整結構（原子由下往上逐層淡入），細節見 demo.ts。 */
export const REVEAL_DURATION = 1.4

export interface PiecePose {
  /** 繞 c 軸的額外旋轉（弧度）；0 = 最終位置。 */
  angle: number
  /** 沿目前方位的徑向位移比例（0 = 已就位，1 = 最外側）。 */
  radial: number
  opacity: number
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x))
}

/**
 * 第 k 塊在時間 time 的姿態。動作分三段：
 * 1. 於第 0 塊的外側淡入（ease-out）；
 * 2. 繞 c 軸公轉到自己的方位（ease-in-out，第 0 塊不需公轉）；
 * 3. 徑向向內就位（ease-out）。
 * reduced = 偏好減少動態效果：不移動，只依序淡入。
 */
export function piecePose(k: number, mode: AssemblyMode, time: number, reduced = false): PiecePose {
  const u = clamp01((time - k * STAGGER) / PIECE_DURATION)
  if (reduced) return { angle: 0, radial: 0, opacity: easeOut(clamp01(u / 0.4)) }
  const orbit = easeInOut(clamp01((u - 0.12) / 0.55))
  return {
    // + 0 將 −0 正規化為 0
    angle: -k * pieceStep(mode) * (1 - orbit) + 0,
    radial: 1 - easeOut(clamp01((u - 0.6) / 0.4)),
    opacity: easeOut(clamp01(u / 0.15)),
  }
}
