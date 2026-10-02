import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, reactive, ref, toRaw, watch } from 'vue'
import { type Centering } from '../core/centering'
import {
  applyGeometryConstraint,
  expandToCellSites,
  nextAtomId,
  siteConflicts,
  type DesignDocument,
  type GeometryConstraint,
  type NeighborRule,
  type Representation,
} from '../core/design'
import { createDraftMeta, type DraftMeta } from '../core/draft'
import { EditHistory } from '../core/history'
import { cellToBasis, fracToCart, validateCell } from '../core/lattice'
import { generatePrismImages, generatePrismLatticePoints } from '../core/hexagonal'
import { nearestNeighborDistance } from '../core/neighbors'
import { clampRepeat, generateImages, generateLatticePoints, wrapPosition } from '../core/periodic'
import type { BasisAtom, CellParams, Direction, RepeatSettings, Vec3 } from '../core/types'
import { findExample } from '../data/examples'
import { buildMotif, defaultParams, type MotifParams } from '../data/types'
import { clearDraft, loadDraft, saveDraft } from '../services/draftStorage'
import { useSettingsStore } from './settings'

const DEFAULT_EXAMPLE = 'cubic'

/**
 * 工作模式：learn（教學）載入正式範例且唯讀；design（設計）編輯由範例深複製而來的草稿。
 * 與顯示版面（ui.mode：探索／投影）及視圖（晶格點／基元／結構）互相獨立。
 */
export type Workspace = 'learn' | 'design'

/** 可復原的草稿快照（不含相機與顯示設定）；教學模式沒有歷史。 */
interface Snapshot {
  cell: CellParams
  basis: BasisAtom[]
  params: MotifParams
  latticeSymbol: string
  representation: Representation
  neighborRules: NeighborRule[]
  geometryConstraint: GeometryConstraint
}

/** 離開設計模式時暫存的草稿，切回時還原。 */
interface StashedDraft extends Snapshot {
  exampleId: string
  draft: DraftMeta
}

/** 深複製；先 toRaw 去掉 Vue 的響應式代理，否則 structuredClone 會丟出 DataCloneError。 */
const clone = <T>(v: T): T => structuredClone(toRaw(v))

const AUTOSAVE_MS = 400

export const useStructureStore = defineStore('structure', () => {
  const initial = findExample(DEFAULT_EXAMPLE)
  /** 目前載入的範例（七大晶系示意晶胞或材料範例）；設計模式為草稿的來源範例。 */
  const exampleId = ref(DEFAULT_EXAMPLE)
  const cell = ref<CellParams>(clone(initial.cell))
  /** 基底原子：motif 表示為與一個晶格點關聯的基元；cellSites 表示為完整晶胞的原子。 */
  const basis = ref<BasisAtom[]>(buildMotif(initial, defaultParams(initial)))
  /** 基元內部參數，例如 α-U 的 y（只在 motif 表示有意義）。 */
  const params = ref<MotifParams>(defaultParams(initial))
  /** 所選布拉菲晶格的皮爾遜符號，例如 cF。 */
  const latticeSymbol = ref(initial.lattices[0].symbol)
  const representation = ref<Representation>('motif')
  /** 設計模式的鄰近連線規則（由來源複製，可編輯；只是距離門檻，不代表化學鍵）。 */
  const neighborRules = ref<NeighborRule[]>([])
  const geometryConstraint = ref<GeometryConstraint>('free')

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

  const history = new EditHistory<Snapshot>()
  const historyVersion = ref(0)

  const source = computed(() => findExample(exampleId.value))
  const systemId = computed(() => source.value.systemId)
  const cellValidation = computed(() => validateCell(cell.value))
  const latticeBasis = computed(() => cellToBasis(cell.value))
  const lattice = computed(
    () => source.value.lattices.find((l) => l.symbol === latticeSymbol.value) ?? source.value.lattices[0],
  )
  /** 有效心型：cellSites 表示只做整數平移（P）。 */
  const centering = computed<Centering>(() => (representation.value === 'cellSites' ? 'P' : lattice.value.centering))
  /** 有效的連線規則：設計模式用草稿的規則，教學模式用來源資料。 */
  const bondRules = computed<NeighborRule[]>(() => (editable.value ? neighborRules.value : (source.value.bonds ?? [])))
  /** 硬球接觸模型只對單一元素的幾何模型有意義。 */
  const hardSphereAllowed = computed(() =>
    editable.value ? new Set(basis.value.map((a) => a.element)).size === 1 && basis.value[0]?.element !== 'X' : !!source.value.hardSphere,
  )
  /** 可調的基元內部參數：cellSites 表示下座標已明列，參數不再適用。 */
  const parameters = computed(() => (representation.value === 'motif' ? (source.value.parameters ?? []) : []))
  /** 設計模式中同位置原子的警告。 */
  const conflicts = computed(() => (editable.value ? siteConflicts(basis.value) : []))

  const images = computed(() => generateImages(basis.value, repeat, centering.value))
  /**
   * 供「裁切至晶胞」使用：區塊外側多包含一層晶胞，讓從外側侵入區塊的球體（例如 HCP 中層原子的鄰居）
   * 也會被裁切平面切出截面；完全在區塊外的球體會被裁切平面整顆剔除，不會顯示。
   */
  const imagesWithMargin = computed(() => generateImages(basis.value, repeat, centering.value, 1))
  const latticePoints = computed(() => generateLatticePoints(repeat, centering.value))
  /** 六方柱（3 個晶胞）內的原子與晶格點，高度沿用 Nc。 */
  const prismImages = computed(() => generatePrismImages(basis.value, repeat.repeatC, centering.value))
  const prismLatticePoints = computed(() => generatePrismLatticePoints(repeat.repeatC))
  /** 最近鄰距離：以 2×2×2 區塊計算以涵蓋跨晶胞的鄰居。 */
  const nearestNeighbor = computed(() => {
    const block = { repeatA: 2, repeatB: 2, repeatC: 2, showBoundaryImages: true }
    const points = generateImages(basis.value, block, centering.value).map((img) => ({
      element: '',
      position: fracToCart(latticeBasis.value, img.fractionalPosition),
    }))
    return nearestNeighborDistance(points)
  })
  const selectedAtom = computed(() => basis.value.find((a) => a.id === selectedAtomId.value) ?? null)

  function snapshot(): Snapshot {
    return {
      cell: clone(cell.value),
      basis: clone(basis.value),
      params: clone(params.value),
      latticeSymbol: latticeSymbol.value,
      representation: representation.value,
      neighborRules: clone(neighborRules.value),
      geometryConstraint: geometryConstraint.value,
    }
  }

  function restore(s: Snapshot) {
    cell.value = clone(s.cell)
    basis.value = clone(s.basis)
    params.value = clone(s.params)
    latticeSymbol.value = s.latticeSymbol
    representation.value = s.representation
    neighborRules.value = clone(s.neighborRules)
    geometryConstraint.value = s.geometryConstraint
    if (!basis.value.some((a) => a.id === selectedAtomId.value)) selectedAtomId.value = null
  }

  // ── 歷史：一次性交易用 commit()，連續操作用 beginEdit()／endEdit() ──
  function commit() {
    if (!editable.value) return
    history.record(snapshot())
    historyVersion.value++
  }
  /** 滑桿拖曳、輸入框編輯開始時呼叫；同一段操作只記一步。 */
  function beginEdit() {
    if (!editable.value) return
    history.begin(snapshot())
    historyVersion.value++
  }
  function endEdit() {
    history.end()
  }
  function clearHistory() {
    history.clear()
    historyVersion.value++
  }

  function loadOfficial(id: string) {
    const s = findExample(id)
    const p = defaultParams(s)
    exampleId.value = id
    latticeSymbol.value = s.lattices[0].symbol
    cell.value = clone(s.cell)
    params.value = p
    basis.value = buildMotif(s, p)
    representation.value = 'motif'
    neighborRules.value = clone(s.bonds ?? [])
    geometryConstraint.value = 'free'
    selectedAtomId.value = null
  }

  /** 載入範例：教學模式顯示正式資料；設計模式則以該範例建立新草稿（取代目前草稿）。 */
  function loadExample(id: string) {
    if (workspace.value === 'design') {
      copyToDesign(id, 'cellSites')
      return
    }
    loadOfficial(id)
    clearHistory()
  }

  /** 還原為來源範例的正式資料（設計模式：草稿內容重設為來源的完整晶胞，草稿身分保留）。 */
  function resetExample() {
    if (workspace.value === 'design') {
      commit()
      loadOfficial(exampleId.value)
      representation.value = 'cellSites'
      basis.value = expandToCellSites(basis.value, lattice.value.centering)
      return
    }
    loadOfficial(exampleId.value)
  }

  /**
   * 複製到設計模式：深複製範例建立草稿；之後的修改都不回寫教學資料。
   * 預設展開為完整晶胞（cellSites），讓原本位於不同心型位置的原子可獨立移動；
   * motif 為進階模式，修改一顆原子會同步套用到所有心型等價位置。
   */
  function copyToDesign(id = exampleId.value, mode: Representation = 'cellSites') {
    stashed = null
    loadOfficial(id)
    if (mode === 'cellSites') {
      basis.value = expandToCellSites(basis.value, lattice.value.centering)
      representation.value = 'cellSites'
    }
    draft.value = createDraftMeta(id, __APP_VERSION__)
    workspace.value = 'design'
    clearHistory()
  }

  /** 將目前草稿由基元表示展開為完整晶胞（單向；可復原）。 */
  function convertToCellSites() {
    if (!editable.value || representation.value !== 'motif') return
    commit()
    basis.value = expandToCellSites(basis.value, lattice.value.centering)
    representation.value = 'cellSites'
  }

  /** 切換工作模式：回教學模式時暫存草稿並重新載入正式資料；回設計模式時還原草稿，沒有草稿則複製目前範例。 */
  function setWorkspace(next: Workspace) {
    if (next === workspace.value) return
    if (next === 'learn') {
      if (draft.value) stashed = { ...snapshot(), exampleId: exampleId.value, draft: draft.value }
      draft.value = null
      workspace.value = 'learn'
      loadOfficial(exampleId.value)
      clearHistory()
      return
    }
    if (!stashed) {
      copyToDesign()
      return
    }
    exampleId.value = stashed.exampleId
    restore(stashed)
    draft.value = stashed.draft
    stashed = null
    workspace.value = 'design'
    clearHistory()
  }

  function setDraftTitle(title: string) {
    if (draft.value) draft.value = { ...draft.value, title: title.trim() || null }
  }

  // ── 原子編輯（只限設計模式）──
  /**
   * 修改原子座標。finalize=false 用於拖曳過程（連續、不折返）；finalize=true 時正規化至 [0,1)。
   * motif 表示下所有心型等價位置同步更新（複本由 images 自動衍生）。
   */
  function setAtomPosition(id: string, position: Vec3, finalize = true) {
    if (!editable.value) return
    const atom = basis.value.find((a) => a.id === id)
    if (!atom || !position.every((v) => Number.isFinite(v))) return
    atom.fractionalPosition = finalize ? wrapPosition(position) : position
  }

  function setAtomElement(id: string, element: string) {
    if (!editable.value) return
    const atom = basis.value.find((a) => a.id === id)
    const symbol = element.trim()
    if (!atom || !symbol || atom.element === symbol) return
    commit()
    atom.element = symbol
    // 改元素後不再沿用來源的顏色與示意半徑
    delete atom.color
    delete atom.displayRadius
    delete atom.positionLabel
  }

  function addAtom(element = 'X', position: Vec3 = [0.5, 0.5, 0.5]): string | null {
    if (!editable.value) return null
    commit()
    const id = nextAtomId(basis.value, element)
    basis.value.push({ id, element, fractionalPosition: wrapPosition(position) })
    selectedAtomId.value = id
    return id
  }

  function removeAtom(id: string) {
    if (!editable.value) return
    const index = basis.value.findIndex((a) => a.id === id)
    if (index < 0) return
    commit()
    basis.value.splice(index, 1)
    if (selectedAtomId.value === id) selectedAtomId.value = null
  }

  // ── 晶胞編輯 ──
  /**
   * 套用晶胞參數（先依幾何約束連動）；無效則不套用並回傳原因，畫面保留上一個有效模型。
   * 分率座標保持不變，原子隨晶胞變形。呼叫端以 beginEdit()／endEdit() 包住連續輸入。
   */
  function setCell(next: CellParams): string | null {
    if (!editable.value) return 'read-only'
    const constrained = applyGeometryConstraint(next, geometryConstraint.value)
    const result = validateCell(constrained)
    if (!result.valid) return result.reason
    cell.value = clone(constrained)
    return null
  }

  function setGeometryConstraint(constraint: GeometryConstraint): string | null {
    if (!editable.value) return 'read-only'
    const constrained = applyGeometryConstraint(cell.value, constraint)
    const result = validateCell(constrained)
    if (!result.valid) return result.reason
    commit()
    geometryConstraint.value = constraint
    cell.value = clone(constrained)
    return null
  }

  /** 修改基元內部參數並重建基元（只限設計模式的 motif 表示）。呼叫端以 beginEdit()／endEdit() 包住拖曳。 */
  function setParam(key: string, value: number) {
    if (!editable.value || representation.value !== 'motif') return
    const def = source.value.parameters?.find((p) => p.key === key)
    if (!def || !Number.isFinite(value)) return
    params.value = { ...params.value, [key]: Math.min(def.max, Math.max(def.min, value)) }
    basis.value = buildMotif(source.value, params.value)
  }

  /** 切換同一晶系內的布拉菲晶格（P／C／I／F），基底原子不變；cellSites 表示固定為 P。 */
  function setLattice(symbol: string) {
    if (representation.value === 'cellSites') return
    if (!source.value.lattices.some((l) => l.symbol === symbol)) return
    if (editable.value) commit()
    latticeSymbol.value = symbol
  }

  // ── 鄰近連線規則（設計模式）──
  function setNeighborRule(index: number, rule: NeighborRule) {
    if (!editable.value || !neighborRules.value[index]) return
    if (!Number.isFinite(rule.maxDistance) || rule.maxDistance <= 0 || !rule.elements.every((e) => e.trim())) return
    commit()
    neighborRules.value[index] = { elements: [rule.elements[0].trim(), rule.elements[1].trim()], maxDistance: rule.maxDistance }
  }
  function addNeighborRule(rule: NeighborRule) {
    if (!editable.value) return
    commit()
    neighborRules.value.push(clone(rule))
  }
  function removeNeighborRule(index: number) {
    if (!editable.value) return
    commit()
    neighborRules.value.splice(index, 1)
  }

  function setRepeat(n: Partial<Pick<RepeatSettings, 'repeatA' | 'repeatB' | 'repeatC'>>) {
    for (const [k, v] of Object.entries(n) as [keyof typeof n, number][]) repeat[k] = clampRepeat(v)
  }

  function undo() {
    const prev = history.undo(snapshot())
    historyVersion.value++
    if (prev) restore(prev)
  }

  function redo() {
    const next = history.redo(snapshot())
    historyVersion.value++
    if (next) restore(next)
  }

  // ── 草稿本機自動保存 ──
  function toDocumentFrom(st: StashedDraft): DesignDocument {
    const s = findExample(st.exampleId)
    const atoms = st.basis.map((a) => ({ id: a.id, element: a.element, fractionalPosition: [...a.fractionalPosition] as Vec3 }))
    const lat = s.lattices.find((l) => l.symbol === st.latticeSymbol) ?? s.lattices[0]
    return {
      schemaVersion: 1,
      id: st.draft.provenance ? `${st.draft.provenance.exampleId}-${st.draft.provenance.copiedAt}` : 'draft',
      title: st.draft.title,
      provenance: st.draft.provenance ?? undefined,
      cell: clone(st.cell),
      lengthUnit: s.lengthUnit === 'Å' ? 'angstrom' : 'schematic',
      cellSetting: s.systemId === 'trigonal' ? 'rhombohedral' : 'conventional',
      representation: st.representation === 'motif' ? { kind: 'motif', centering: lat.centering, atoms } : { kind: 'cellSites', atoms },
      geometryConstraint: st.geometryConstraint,
      neighborRules: clone(st.neighborRules),
      scientificStatus: 'custom-unverified',
      params: st.representation === 'motif' ? clone(st.params) : undefined,
    }
  }

  function toDocument(): DesignDocument | null {
    if (!draft.value) return null
    return toDocumentFrom({ ...snapshot(), exampleId: exampleId.value, draft: draft.value })
  }

  /** 由本機保存的文件還原成暫存草稿（下次切到設計模式時載入）。 */
  function fromDocument(doc: DesignDocument): StashedDraft | null {
    const id = doc.provenance?.exampleId ?? DEFAULT_EXAMPLE
    let s
    try {
      s = findExample(id)
    } catch {
      return null
    }
    const centeringOf = doc.representation.kind === 'motif' ? doc.representation.centering : 'P'
    const lat = s.lattices.find((l) => l.centering === centeringOf) ?? s.lattices[0]
    return {
      exampleId: id,
      draft: { title: doc.title, provenance: doc.provenance ?? null, scientificStatus: 'custom-unverified' },
      cell: doc.cell,
      basis: doc.representation.atoms.map((a) => ({ id: a.id, element: a.element, fractionalPosition: a.fractionalPosition })),
      params: { ...defaultParams(s), ...(doc.params ?? {}) },
      latticeSymbol: lat.symbol,
      representation: doc.representation.kind,
      neighborRules: doc.neighborRules,
      geometryConstraint: doc.geometryConstraint,
    }
  }

  const saved = loadDraft()
  if (saved) stashed = fromDocument(saved)

  let saveTimer = 0
  watch(
    () => (workspace.value === 'design' ? toDocument() : null),
    (doc) => {
      clearTimeout(saveTimer)
      if (!doc) return
      saveTimer = window.setTimeout(() => saveDraft(doc), AUTOSAVE_MS)
    },
    { deep: true },
  )
  /** 切回教學模式時也要保存暫存的草稿（上面的 watch 在教學模式看不到草稿內容）。 */
  watch(workspace, (w) => {
    if (w !== 'learn') return
    if (stashed) saveDraft(toDocumentFrom(stashed))
    else clearDraft()
  })

  /** 是否有可還原的草稿（記憶體或本機保存）。 */
  const hasDraft = computed(() => workspace.value === 'design' || stashed !== null)

  return {
    exampleId,
    systemId,
    cell,
    basis,
    params,
    latticeSymbol,
    representation,
    neighborRules,
    geometryConstraint,
    workspace,
    draft,
    editable,
    isCustom,
    hasDraft,
    repeat,
    direction,
    directionEnabled,
    selectedAtomId,
    source,
    cellValidation,
    latticeBasis,
    lattice,
    centering,
    bondRules,
    hardSphereAllowed,
    parameters,
    conflicts,
    images,
    imagesWithMargin,
    latticePoints,
    nearestNeighbor,
    prismImages,
    prismLatticePoints,
    selectedAtom,
    canUndo: computed(() => historyVersion.value >= 0 && history.canUndo),
    canRedo: computed(() => historyVersion.value >= 0 && history.canRedo),
    commit,
    beginEdit,
    endEdit,
    loadExample,
    resetExample,
    copyToDesign,
    convertToCellSites,
    setWorkspace,
    setDraftTitle,
    setAtomPosition,
    setAtomElement,
    addAtom,
    removeAtom,
    setCell,
    setGeometryConstraint,
    setLattice,
    setParam,
    setNeighborRule,
    addNeighborRule,
    removeNeighborRule,
    setRepeat,
    undo,
    redo,
  }
})

// 開發時熱更新 store 定義，避免元件已換新程式碼而 store 仍為舊版本
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useStructureStore, import.meta.hot))
