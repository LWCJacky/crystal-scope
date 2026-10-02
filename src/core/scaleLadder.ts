import { easeInOut } from './easing'

/**
 * 尺度之旅（Powers-of-Ten 式連續放大）的純數學核心。
 *
 * 單一標量 zoom ∈ [0,1] 以「對數尺度」對應畫面的視野高度（公尺）：
 *   log10 H(zoom) = lerp(log10 H_start, log10 H_end, zoom)
 * 等速推進 zoom 即為「每秒固定倍率」的放大，從公分到奈米感覺一樣快。
 *
 * 從 1 cm 到 0.3 nm 約 10⁸ 倍，單一 3D 場景的浮點精度做不到，因此採「尺度階梯」：
 * 每一級場景使用自己的單位（metresPerUnit），各自以 H(zoom) 換算相機距離並分別繪製，
 * 交接處以不透明度淡入淡出。畫面上的大小與比例尺完全一致，觀眾感覺是一鏡到底。
 */

export type LadderStageId = 'macro' | 'field' | 'block' | 'cell' | 'motif'

export interface LadderStageSpec {
  id: LadderStageId
  /** 此級場景 1 單位對應的公尺數。 */
  metresPerUnit: number
  /** 淡入：視野高度（公尺）由 fadeIn[0] 縮到 fadeIn[1] 時由 0 → 1；null 表示從頭即可見。 */
  fadeIn: [number, number] | null
  /** 淡出：視野高度由 fadeOut[0] 縮到 fadeOut[1] 時由 1 → 0；null 表示到最後仍可見。 */
  fadeOut: [number, number] | null
  /**
   * 相機不再靠近的視野高度下限（公尺）。巨觀物件靠得太近會超出 float32 精度，
   * 但此時畫面已在單一晶粒內、為均勻色塊，凍結相機在視覺上無差別。
   */
  minHeight?: number
}

/** 時間軸分段：由上一段的終點（或起點）在 seconds 秒內放大到 toHeight。 */
export interface LadderSegment {
  toHeight: number
  seconds: number
}

export interface LadderProfile {
  /** 起點與終點的視野高度（公尺）。 */
  startHeight: number
  endHeight: number
  stages: LadderStageSpec[]
  /**
   * 時間軸：各段在對數空間內等速，但段與段的速度不同——
   * 沒有可見結構的區段（晶粒內部、單晶平坦表面）快速掠過，有內容的區段放慢。
   */
  segments: LadderSegment[]
  /** 基元階段相機目標由晶胞中心移到原點晶格點的區間（視野高度，公尺）。 */
  targetShift: [number, number]
}

export interface LadderStageState {
  id: LadderStageId
  opacity: number
  /** 此級場景單位下的視野高度；相機距離 = 高度 / (2 tan(fov/2))。 */
  viewHeightUnits: number
}

export interface LadderState {
  /** 視野高度（公尺）。 */
  heightMetres: number
  stages: LadderStageState[]
  /** 0 = 相機目標在晶胞中心，1 = 在原點晶格點。 */
  targetBlend: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const log = Math.log10

/** 視野高度由 from 縮到 to 時的進度（0 → 1），對數空間線性。 */
function rampProgress(height: number, [from, to]: [number, number]): number {
  return clamp01((log(from) - log(height)) / (log(from) - log(to)))
}

export function ladderHeight(profile: LadderProfile, zoom: number): number {
  const z = clamp01(zoom)
  return 10 ** (log(profile.startHeight) + (log(profile.endHeight) - log(profile.startHeight)) * z)
}

/** 晶格各級的場景單位為 Å。 */
export const ANGSTROM = 1e-10
/** 實心球區塊的邊長（晶胞數）。 */
export const BLOCK_CELLS = 11
/** 起點視野高度 4 cm；巨觀物件約 2 cm。 */
export const START_HEIGHT = 0.04
/** 金屬棒：半徑 1 單位 = 1 cm。 */
export const ROD_METRES_PER_UNIT = 0.01
/** 巨觀物件相機凍結的視野高度：10 µm（晶粒約 50 µm，此時已在單一晶粒內）。 */
export const MACRO_MIN_HEIGHT = 1e-5

/**
 * 依晶胞尺寸（公尺）建立剖面：巨觀物件 2 cm，晶格區塊 5 個晶胞，晶胞，基元。
 * 各級淡入淡出以晶胞尺寸 a 的倍數定義，材料不同時仍保持相同的畫面節奏。
 * macroMetresPerUnit：巨觀場景 1 單位對應的公尺數。
 */
export function buildLadderProfile(cellMetres: number, macroMetresPerUnit = 0.01, polycrystalline = true): LadderProfile {
  const a = cellMetres
  const endHeight = 1.4 * a
  // 巨觀物件 → 表面晶格的交接高度：單晶在 1 mm 附近（外形邊緣已在畫面外），
  // 多晶在 10 µm 附近（已進入單一晶粒，切面為均勻色）
  const macroOut: [number, number] = polycrystalline ? [8e-6, 3e-6] : [9e-4, 3.5e-4]
  const fieldIn: [number, number] = polycrystalline ? [1.4e-5, 4e-6] : [2e-3, 6e-4]
  return {
    startHeight: START_HEIGHT,
    endHeight,
    stages: [
      {
        id: 'macro',
        metresPerUnit: macroMetresPerUnit,
        fadeIn: null,
        fadeOut: macroOut,
        // 金屬棒切面在極近距離會超出 float32 精度，於 10 µm 凍結相機（此時已是均勻色）；單晶外形不需要
        minHeight: polycrystalline ? MACRO_MIN_HEIGHT : undefined,
      },
      // 表面晶格：GPU 依視野即時產生表面的原子，遠處自動融入同色的實心面，
      // 由 1 mm 一路連續到晶格尺度；相機俯視表面，不會穿進晶格內部
      { id: 'field', metresPerUnit: ANGSTROM, fadeIn: fieldIn, fadeOut: [14 * a, 10 * a] },
      // 11³ 實心球（含鍵）：承接表面晶格的中央區域，頂面與表面齊平
      { id: 'block', metresPerUnit: ANGSTROM, fadeIn: [20 * a, 12 * a], fadeOut: [10 * a, 7.5 * a] },
      // 晶胞級先於區塊淡出前完全顯示（兩者的中央晶胞完全重合，重疊繪製看不出差異），
      // 再於相機目標移向原點晶格點時淡出，交給基元級
      { id: 'cell', metresPerUnit: ANGSTROM, fadeIn: [15 * a, 12 * a], fadeOut: [2.4 * a, 1.6 * a] },
      { id: 'motif', metresPerUnit: ANGSTROM, fadeIn: [2.2 * a, 1.6 * a], fadeOut: null },
    ],
    targetShift: [2.4 * a, 1.6 * a],
    segments: polycrystalline
      ? [
          { toHeight: 4e-4, seconds: 3.5 }, // 4 cm → 400 µm：看見金屬棒，晶粒逐漸浮現
          { toHeight: 4e-5, seconds: 3.5 }, // 400 µm → 40 µm：晶粒
          { toHeight: 2e-7, seconds: 2.5 }, // 晶粒內部：均勻色，快速掠過；原子於 ~70 nm 開始可辨
          { toHeight: endHeight, seconds: 8 }, // 表面原子 → 區塊 → 晶胞 → 基元
        ]
      : [
          { toHeight: 1.5e-3, seconds: 2 }, // 看見單晶外形，推向表面
          { toHeight: 2e-7, seconds: 3.5 }, // 平坦表面：快速掠過；原子於 ~70 nm 開始可辨
          { toHeight: endHeight, seconds: 8 },
        ],
  }
}

export function ladderSeconds(profile: LadderProfile): number {
  return profile.segments.reduce((sum, s) => sum + s.seconds, 0)
}

/** 時間（秒）→ zoom ∈ [0,1]：各段在對數空間內等速。 */
export function zoomAtTime(profile: LadderProfile, time: number): number {
  const total = log(profile.endHeight) - log(profile.startHeight)
  let t = time
  let from = profile.startHeight
  for (const seg of profile.segments) {
    if (t <= seg.seconds) {
      const h = 10 ** (log(from) + (log(seg.toHeight) - log(from)) * (t / seg.seconds))
      return clamp01((log(h) - log(profile.startHeight)) / total)
    }
    t -= seg.seconds
    from = seg.toHeight
  }
  return 1
}

/**
 * zoom 時刻各級的不透明度與視野高度。
 * reduced（減少動態效果）：相機不連續推進，每級固定在自己可見區間中段的視野高度，
 * 只保留淡入淡出，效果等同幻燈片。
 */
export function ladderState(profile: LadderProfile, zoom: number, reduced = false): LadderState {
  const height = ladderHeight(profile, zoom)
  const stages = profile.stages.map((s) => {
    const fadeIn = s.fadeIn ? easeInOut(rampProgress(height, s.fadeIn)) : 1
    const fadeOut = s.fadeOut ? 1 - easeInOut(rampProgress(height, s.fadeOut)) : 1
    const opacity = Math.min(fadeIn, fadeOut)
    let h = height
    if (reduced) {
      const top = s.fadeIn ? s.fadeIn[1] : profile.startHeight
      const bottom = s.fadeOut ? s.fadeOut[0] : profile.endHeight
      h = 10 ** ((log(top) + log(bottom)) / 2)
    }
    if (s.minHeight) h = Math.max(h, s.minHeight)
    return { id: s.id, opacity, viewHeightUnits: h / s.metresPerUnit }
  })
  return { heightMetres: height, stages, targetBlend: easeInOut(rampProgress(height, profile.targetShift)) }
}

/** 哪些級目前需要繪製（不透明度 > 0）。 */
export function visibleStages(state: LadderState): LadderStageState[] {
  return state.stages.filter((s) => s.opacity > 0.001)
}

const UNITS: [number, string][] = [
  [1, 'm'],
  [1e-2, 'cm'],
  [1e-3, 'mm'],
  [1e-6, 'µm'],
  [1e-9, 'nm'],
  [1e-10, 'Å'],
]

/** 以適當單位顯示長度：0.012 → 1.2 cm、3.6e-10 → 3.6 Å。 */
export function formatLength(metres: number): string {
  for (const [unit, name] of UNITS) {
    if (metres >= unit * 0.999 || name === 'Å') {
      const v = metres / unit
      const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, '')
      return `${text} ${name}`
    }
  }
  return `${metres} m`
}

/**
 * 比例尺長度：不超過 maxFraction × 視野高度的最大「整數×10ⁿ」（1、2、5 系列）。
 * 回傳公尺數與其在畫面上所佔的比例。
 */
export function scaleBar(heightMetres: number, maxFraction = 0.35): { metres: number; fraction: number } {
  const limit = heightMetres * maxFraction
  const exp = Math.floor(log(limit))
  let best = 10 ** exp
  for (const m of [1, 2, 5]) if (m * 10 ** exp <= limit) best = m * 10 ** exp
  return { metres: best, fraction: best / heightMetres }
}
