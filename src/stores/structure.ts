import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cellToBasis, validateCell } from '../core/lattice'
import { clampRepeat, generateImages, wrapPosition } from '../core/periodic'
import type { BasisAtom, CellParams, CrystalSystemId, Direction, RepeatSettings, Vec3 } from '../core/types'
import { findSystem } from '../data/crystalSystems'

/** 可復原的結構快照（不含相機與顯示設定）。 */
interface Snapshot {
  cell: CellParams
  basis: BasisAtom[]
  isCustom: boolean
}

const HISTORY_LIMIT = 100

const clone = <T>(v: T): T => structuredClone(v)

export const useStructureStore = defineStore('structure', () => {
  const systemId = ref<CrystalSystemId>('cubic')
  const cell = ref<CellParams>(clone(findSystem('cubic').cell))
  const basis = ref<BasisAtom[]>(clone(findSystem('cubic').basis))
  /** 編輯後為 true：不再宣稱屬於來源晶系，只保留來源範例名稱。 */
  const isCustom = ref(false)

  const repeat = ref<RepeatSettings>({ repeatA: 1, repeatB: 1, repeatC: 1, showBoundaryImages: true })
  const direction = ref<Direction>({ u: 1, v: 1, w: 1, origin: [0, 0, 0], displayLength: 1 })
  const directionEnabled = ref(false)
  const selectedAtomId = ref<string | null>(null)

  const past = ref<Snapshot[]>([])
  const future = ref<Snapshot[]>([])

  const source = computed(() => findSystem(systemId.value))
  const cellValidation = computed(() => validateCell(cell.value))
  const latticeBasis = computed(() => cellToBasis(cell.value))
  const images = computed(() => generateImages(basis.value, repeat.value))
  const selectedAtom = computed(() => basis.value.find((a) => a.id === selectedAtomId.value) ?? null)

  function snapshot(): Snapshot {
    return { cell: clone(cell.value), basis: clone(basis.value), isCustom: isCustom.value }
  }

  function restore(s: Snapshot) {
    cell.value = clone(s.cell)
    basis.value = clone(s.basis)
    isCustom.value = s.isCustom
    if (!basis.value.some((a) => a.id === selectedAtomId.value)) selectedAtomId.value = null
  }

  /** 在修改結構前呼叫，記錄一步歷史。 */
  function commit() {
    past.value.push(snapshot())
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  function loadSystem(id: CrystalSystemId) {
    systemId.value = id
    resetExample()
    past.value = []
    future.value = []
  }

  function resetExample() {
    const s = findSystem(systemId.value)
    cell.value = clone(s.cell)
    basis.value = clone(s.basis)
    isCustom.value = false
    selectedAtomId.value = null
  }

  /**
   * 週期編輯：只修改基底原子，所有複本由 images 自動同步。
   * finalize=false 用於拖曳過程（連續、不折返）；finalize=true 時正規化至 [0,1)。
   */
  function setAtomPosition(id: string, position: Vec3, finalize = true) {
    const atom = basis.value.find((a) => a.id === id)
    if (!atom) return
    atom.fractionalPosition = finalize ? wrapPosition(position) : position
    isCustom.value = true
  }

  /** 套用晶胞參數；無效則不套用並回傳原因。分率座標保持不變，原子隨晶胞變形。 */
  function setCell(next: CellParams): string | null {
    const result = validateCell(next)
    if (!result.valid) return result.reason
    commit()
    cell.value = clone(next)
    isCustom.value = true
    return null
  }

  function setRepeat(n: Partial<Pick<RepeatSettings, 'repeatA' | 'repeatB' | 'repeatC'>>) {
    for (const [k, v] of Object.entries(n) as [keyof typeof n, number][]) repeat.value[k] = clampRepeat(v)
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
    systemId,
    cell,
    basis,
    isCustom,
    repeat,
    direction,
    directionEnabled,
    selectedAtomId,
    source,
    cellValidation,
    latticeBasis,
    images,
    selectedAtom,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    commit,
    loadSystem,
    resetExample,
    setAtomPosition,
    setCell,
    setRepeat,
    undo,
    redo,
  }
})
