import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import { copyStructure, createDraftMeta, type DraftMeta } from '../core/draft'
import { cellToBasis, fracToCart, validateCell } from '../core/lattice'
import { generatePrismImages, generatePrismLatticePoints } from '../core/hexagonal'
import { nearestNeighborDistance } from '../core/neighbors'
import { clampRepeat, generateImages, generateLatticePoints, wrapPosition } from '../core/periodic'
import type { BasisAtom, CellParams, Direction, RepeatSettings, Vec3 } from '../core/types'
import { findExample } from '../data/examples'
import { buildMotif, defaultParams, type MotifParams } from '../data/types'
import { useSettingsStore } from './settings'

const DEFAULT_EXAMPLE = 'cubic'

/** 可復原的結構快照（不含相機與顯示設定）。 */
interface Snapshot {
  cell: CellParams
  basis: BasisAtom[]
  params: MotifParams
}

/**
 * 工作模式：learn（教學）載入正式範例且唯讀；design（設計）編輯由範例深複製而來的草稿。
 * 與顯示版面（ui.mode：探索／投影）及視圖（晶格點／基元／結構）互相獨立。
 */
export type Workspace = 'learn' | 'design'

/** 離開設計模式時暫存的草稿，切回時還原（第一版只保留一份、不落地）。 */
interface StashedDraft extends Snapshot {
  exampleId: string
  latticeSymbol: string
  draft: DraftMeta
}

const HISTORY_LIMIT = 100

/** 深複製；先 toRaw 去掉 Vue 的響應式代理，否則 structuredClone 會丟出 DataCloneError。 */
const clone = <T>(v: T): T => structuredClone(toRaw(v))

export const useStructureStore = defineStore('structure', () => {
  const initial = findExample(DEFAULT_EXAMPLE)
  /** 目前載入的範例（七大晶系示意晶胞或材料範例）。 */
  const exampleId = ref(DEFAULT_EXAMPLE)
  const cell = ref<CellParams>(clone(initial.cell))
  /** 基底（基元）原子：與一個晶格點相關聯的原子。 */
  const basis = ref<BasisAtom[]>(buildMotif(initial, defaultParams(initial)))
  /** 基元內部參數，例如 α-U 的 y。 */
  const params = ref<MotifParams>(defaultParams(initial))
  /** 所選布拉菲晶格的皮爾遜符號，例如 cF。 */
  const latticeSymbol = ref(initial.lattices[0].symbol)
  const workspace = ref<Workspace>('learn')
  /** 設計模式的草稿中繼資料；教學模式為 null。 */
  const draft = ref<DraftMeta | null>(null)
  let stashed: StashedDraft | null = null
  /** 只有設計模式可修改結構；教學模式的正式資料唯讀。 */
  const editable = computed(() => workspace.value === 'design')
  /** 設計草稿一律視為自訂、未驗證結構，即使尚未修改。 */
  const isCustom = computed(() => workspace.value === 'design')

  const settings = useSettingsStore().values
  // 「邊界複本」為共用設定：以存取器直接讀寫 settings，只有一份真實來源
  const repeat = reactive<RepeatSettings>({
    repeatA: 1,
    repeatB: 1,
    repeatC: 1,
    get showBoundaryImages() {
      return settings.showBoundaryImages
    },
    set showBoundaryImages(v: boolean) {
      settings.showBoundaryImages = v
    },
  })
  const direction = ref<Direction>({ u: 1, v: 1, w: 1, origin: [0, 0, 0], displayLength: 1 })
  const directionEnabled = ref(false)
  const selectedAtomId = ref<string | null>(null)

  const past = ref<Snapshot[]>([])
  const future = ref<Snapshot[]>([])

  const source = computed(() => findExample(exampleId.value))
  const systemId = computed(() => source.value.systemId)
  const cellValidation = computed(() => validateCell(cell.value))
  const latticeBasis = computed(() => cellToBasis(cell.value))
  const lattice = computed(
    () => source.value.lattices.find((l) => l.symbol === latticeSymbol.value) ?? source.value.lattices[0],
  )
  const images = computed(() => generateImages(basis.value, repeat, lattice.value.centering))
  /**
   * 供「裁切至晶胞」使用：區塊外側多包含一層晶胞，讓從外側侵入區塊的球體（例如 HCP 中層原子的鄰居）
   * 也會被裁切平面切出截面；完全在區塊外的球體會被裁切平面整顆剔除，不會顯示。
   */
  const imagesWithMargin = computed(() => generateImages(basis.value, repeat, lattice.value.centering, 1))
  const latticePoints = computed(() => generateLatticePoints(repeat, lattice.value.centering))
  /** 六方柱（3 個晶胞）內的原子與晶格點，高度沿用 Nc。 */
  const prismImages = computed(() => generatePrismImages(basis.value, repeat.repeatC, lattice.value.centering))
  const prismLatticePoints = computed(() => generatePrismLatticePoints(repeat.repeatC))
  /** 最近鄰距離：以 2×2×2 區塊計算以涵蓋跨晶胞的鄰居。 */
  const nearestNeighbor = computed(() => {
    const block = { repeatA: 2, repeatB: 2, repeatC: 2, showBoundaryImages: true }
    const points = generateImages(basis.value, block, lattice.value.centering).map((img) => ({
      element: '',
      position: fracToCart(latticeBasis.value, img.fractionalPosition),
    }))
    return nearestNeighborDistance(points)
  })
  const selectedAtom = computed(() => basis.value.find((a) => a.id === selectedAtomId.value) ?? null)

  function snapshot(): Snapshot {
    return { cell: clone(cell.value), basis: clone(basis.value), params: clone(params.value) }
  }

  function restore(s: Snapshot) {
    cell.value = clone(s.cell)
    basis.value = clone(s.basis)
    params.value = clone(s.params)
    if (!basis.value.some((a) => a.id === selectedAtomId.value)) selectedAtomId.value = null
  }

  function clearHistory() {
    past.value = []
    future.value = []
  }

  /** 在修改結構前呼叫，記錄一步歷史。 */
  function commit() {
    past.value.push(snapshot())
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  /** 載入範例：教學模式顯示正式資料；設計模式則以該範例建立新草稿（取代目前草稿）。 */
  function loadExample(id: string) {
    exampleId.value = id
    latticeSymbol.value = findExample(id).lattices[0].symbol
    resetExample()
    clearHistory()
    if (workspace.value === 'design') draft.value = createDraftMeta(id, __APP_VERSION__)
  }

  /** 還原為來源範例的正式資料（設計模式：草稿內容重設，草稿身分保留）。 */
  function resetExample() {
    const s = source.value
    const p = defaultParams(s)
    const copy = copyStructure(s.cell, buildMotif(s, p), p)
    cell.value = copy.cell
    params.value = copy.params
    basis.value = copy.basis
    selectedAtomId.value = null
  }

  /** 複製到設計模式：以目前範例深複製建立草稿；之後的修改都不回寫教學資料。 */
  function copyToDesign() {
    stashed = null
    draft.value = createDraftMeta(exampleId.value, __APP_VERSION__)
    workspace.value = 'design'
    resetExample()
    clearHistory()
  }

  /** 切換工作模式：回教學模式時暫存草稿並重新載入正式資料；回設計模式時還原草稿，沒有草稿則複製目前範例。 */
  function setWorkspace(next: Workspace) {
    if (next === workspace.value) return
    if (next === 'learn') {
      if (draft.value) stashed = { ...snapshot(), exampleId: exampleId.value, latticeSymbol: latticeSymbol.value, draft: draft.value }
      draft.value = null
      workspace.value = 'learn'
      resetExample()
      clearHistory()
      return
    }
    if (!stashed) {
      copyToDesign()
      return
    }
    exampleId.value = stashed.exampleId
    latticeSymbol.value = stashed.latticeSymbol
    restore(stashed)
    draft.value = stashed.draft
    stashed = null
    workspace.value = 'design'
    clearHistory()
  }

  function setDraftTitle(title: string) {
    if (draft.value) draft.value = { ...draft.value, title: title.trim() || null }
  }

  /**
   * 週期編輯：只修改基底原子，所有複本由 images 自動同步。
   * finalize=false 用於拖曳過程（連續、不折返）；finalize=true 時正規化至 [0,1)。
   */
  function setAtomPosition(id: string, position: Vec3, finalize = true) {
    if (!editable.value) return
    const atom = basis.value.find((a) => a.id === id)
    if (!atom) return
    atom.fractionalPosition = finalize ? wrapPosition(position) : position
  }

  /** 套用晶胞參數；無效則不套用並回傳原因。分率座標保持不變，原子隨晶胞變形。 */
  function setCell(next: CellParams): string | null {
    if (!editable.value) return 'read-only'
    const result = validateCell(next)
    if (!result.valid) return result.reason
    commit()
    cell.value = clone(next)
    return null
  }

  /** 修改基元內部參數並重建基元（只限設計模式）。呼叫端負責在拖動開始時 commit()。 */
  function setParam(key: string, value: number) {
    if (!editable.value) return
    const def = source.value.parameters?.find((p) => p.key === key)
    if (!def) return
    params.value = { ...params.value, [key]: Math.min(def.max, Math.max(def.min, value)) }
    basis.value = buildMotif(source.value, params.value)
  }

  /** 切換同一晶系內的布拉菲晶格（P／C／I／F），基底原子不變。 */
  function setLattice(symbol: string) {
    if (source.value.lattices.some((l) => l.symbol === symbol)) latticeSymbol.value = symbol
  }

  function setRepeat(n: Partial<Pick<RepeatSettings, 'repeatA' | 'repeatB' | 'repeatC'>>) {
    for (const [k, v] of Object.entries(n) as [keyof typeof n, number][]) repeat[k] = clampRepeat(v)
  }

  function undo() {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(snapshot())
    restore(prev)
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(snapshot())
    restore(next)
  }

  return {
    exampleId,
    systemId,
    cell,
    basis,
    params,
    latticeSymbol,
    workspace,
    draft,
    editable,
    isCustom,
    repeat,
    direction,
    directionEnabled,
    selectedAtomId,
    source,
    cellValidation,
    latticeBasis,
    lattice,
    images,
    imagesWithMargin,
    latticePoints,
    nearestNeighbor,
    prismImages,
    prismLatticePoints,
    selectedAtom,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    commit,
    loadExample,
    resetExample,
    copyToDesign,
    setWorkspace,
    setDraftTitle,
    setAtomPosition,
    setCell,
    setLattice,
    setParam,
    setRepeat,
    undo,
    redo,
  }
})

// 開發時熱更新 store 定義，避免元件已換新程式碼而 store 仍為舊版本
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useStructureStore, import.meta.hot))
