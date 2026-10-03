import { applyConstraints, lockedKeys } from './constraints'
import { centeringTranslations, type Centering } from './centering'
import { validateCell } from './lattice'
import { wrapPosition } from './periodic'
import type { BasisAtom, CellParams, CrystalSystemId, Vec3 } from './types'
import type { DraftProvenance } from './draft'

/**
 * 設計模式的資料契約（規格 5.3／5.4）。
 * 兩種結構表示不可混用：
 * - motif：每個晶格點的基元 × 心型平移（修改一顆原子會同步套用到所有心型等價位置）。
 * - cellSites：完整晶胞原子明列，只做整數晶胞平移（心型固定為 P）。
 */
export type Representation = 'motif' | 'cellSites'

export type GeometryConstraint = 'free' | 'cubic' | 'tetragonal' | 'orthorhombic' | 'hexagonal' | 'rhombohedral' | 'monoclinic'

export const GEOMETRY_CONSTRAINTS: readonly GeometryConstraint[] = ['free', 'cubic', 'tetragonal', 'orthorhombic', 'hexagonal', 'rhombohedral', 'monoclinic']

export interface NeighborRule {
  elements: [string, string]
  maxDistance: number
}

export interface AtomSite {
  id: string
  element: string
  fractionalPosition: Vec3
}

export type AtomRepresentation =
  | { kind: 'motif'; centering: Centering; atoms: AtomSite[] }
  | { kind: 'cellSites'; atoms: AtomSite[] }

/** 草稿檔的格式標記與副檔名：檔案選擇器只列出 .csdraft，內容仍是 JSON；改名後仍可由 format 辨識。 */
export const DRAFT_FORMAT = 'crystalscope-draft'
export const DRAFT_EXTENSION = '.csdraft'

export interface DesignDocument {
  format: typeof DRAFT_FORMAT
  schemaVersion: 1
  id: string
  title: string | null
  provenance?: DraftProvenance
  cell: CellParams
  lengthUnit: 'angstrom' | 'schematic'
  cellSetting: 'conventional' | 'rhombohedral' | 'custom'
  representation: AtomRepresentation
  geometryConstraint: GeometryConstraint
  neighborRules: NeighborRule[]
  /** 自由編排成功不表示材料真實存在或結構穩定。 */
  scientificStatus: 'custom-unverified'
  /** 基元內部參數（motif 表示且來源有參數時）。 */
  params?: Record<string, number>
}

export const MAX_ATOMS = 2000

/** 幾何約束 → 既有晶系鎖定表（只限制晶胞長度與角度，不宣稱對稱性）。 */
const CONSTRAINT_SYSTEM: Record<GeometryConstraint, CrystalSystemId> = {
  free: 'triclinic',
  cubic: 'cubic',
  tetragonal: 'tetragonal',
  orthorhombic: 'orthorhombic',
  hexagonal: 'hexagonal',
  rhombohedral: 'trigonal',
  monoclinic: 'monoclinic',
}

export function applyGeometryConstraint(cell: CellParams, constraint: GeometryConstraint): CellParams {
  return applyConstraints(CONSTRAINT_SYSTEM[constraint], cell)
}

/** 受約束而不可直接編輯的欄位。 */
export function constrainedKeys(constraint: GeometryConstraint): (keyof CellParams)[] {
  return lockedKeys(CONSTRAINT_SYSTEM[constraint])
}

/**
 * 把「基元 × 心型」展開成完整晶胞原子列表（心型改為 P）。
 * 第一個平移保留原 id；其餘以 `id~kind` 命名，座標折返進晶胞；符號式標籤不再適用。
 */
export function expandToCellSites(basis: readonly BasisAtom[], centering: Centering): BasisAtom[] {
  const out: BasisAtom[] = []
  centeringTranslations(centering).forEach((t, k) => {
    for (const atom of basis) {
      const { positionLabel: _label, ...rest } = atom
      out.push({
        ...rest,
        id: k === 0 ? atom.id : `${atom.id}~${t.kind}${k}`,
        fractionalPosition: wrapPosition(atom.fractionalPosition.map((v, i) => v + t.vector[i]) as Vec3),
      })
    }
  })
  return out
}

export interface SiteConflict {
  a: string
  b: string
  sameElement: boolean
}

/** 以週期等價（各軸差取最短）與容差找出同位置的原子；同元素＝重複計數，不同元素＝衝突（不支援部分占位）。 */
export function siteConflicts(atoms: readonly BasisAtom[], tolerance = 1e-4): SiteConflict[] {
  const out: SiteConflict[] = []
  const wrapped = atoms.map((a) => wrapPosition(a.fractionalPosition))
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const close = [0, 1, 2].every((k) => {
        const d = Math.abs(wrapped[i][k] - wrapped[j][k])
        return Math.min(d, 1 - d) < tolerance
      })
      if (close) out.push({ a: atoms[i].id, b: atoms[j].id, sameElement: atoms[i].element === atoms[j].element })
    }
  }
  return out
}

/** 新原子的 id：不與現有 id 衝突。 */
export function nextAtomId(atoms: readonly { id: string }[], element: string): string {
  const base = element.toLowerCase() || 'atom'
  let n = atoms.length + 1
  let id = `${base}-${n}`
  const ids = new Set(atoms.map((a) => a.id))
  while (ids.has(id)) id = `${base}-${++n}`
  return id
}

export type ParseResult = { ok: true; doc: DesignDocument } | { ok: false; error: string }

const isFinitePos = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x))

/** 驗證匯入／本機保存的草稿；任何不合法之處都回傳明確錯誤，不嘗試修補。 */
export function parseDesignDocument(input: unknown): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error })
  if (!input || typeof input !== 'object') return fail('not an object')
  const d = input as Record<string, unknown>
  if (d.format !== undefined && d.format !== DRAFT_FORMAT) return fail(`not a CrystalScope draft (format: ${String(d.format)})`)
  if (d.schemaVersion !== 1) return fail(`unsupported schemaVersion: ${String(d.schemaVersion)}`)
  if (typeof d.id !== 'string' || !d.id) return fail('missing id')
  if (d.title !== null && d.title !== undefined && typeof d.title !== 'string') return fail('title must be a string or null')
  const cell = d.cell as Record<string, unknown> | undefined
  if (!cell || typeof cell !== 'object') return fail('missing cell')
  for (const k of ['a', 'b', 'c', 'alpha', 'beta', 'gamma']) {
    if (typeof cell[k] !== 'number' || !Number.isFinite(cell[k])) return fail(`cell.${k} must be a finite number`)
  }
  const cellParams = cell as unknown as CellParams
  const validation = validateCell(cellParams)
  if (!validation.valid) return fail(`invalid cell: ${validation.reason}`)
  if (d.lengthUnit !== 'angstrom' && d.lengthUnit !== 'schematic') return fail('lengthUnit must be angstrom or schematic')
  if (d.cellSetting !== 'conventional' && d.cellSetting !== 'rhombohedral' && d.cellSetting !== 'custom') return fail('invalid cellSetting')
  if (!GEOMETRY_CONSTRAINTS.includes(d.geometryConstraint as GeometryConstraint)) return fail('invalid geometryConstraint')
  const rep = d.representation as Record<string, unknown> | undefined
  if (!rep || typeof rep !== 'object') return fail('missing representation')
  if (rep.kind !== 'motif' && rep.kind !== 'cellSites') return fail('representation.kind must be motif or cellSites')
  if (rep.kind === 'motif' && !['P', 'C', 'I', 'F'].includes(rep.centering as string)) return fail('motif representation needs centering P/C/I/F')
  if (!Array.isArray(rep.atoms)) return fail('representation.atoms must be an array')
  if (rep.atoms.length > MAX_ATOMS) return fail(`too many atoms (max ${MAX_ATOMS})`)
  const ids = new Set<string>()
  const atoms: AtomSite[] = []
  for (const raw of rep.atoms as unknown[]) {
    const a = raw as Record<string, unknown>
    if (!a || typeof a !== 'object') return fail('atom must be an object')
    if (typeof a.id !== 'string' || !a.id) return fail('atom id missing')
    if (ids.has(a.id)) return fail(`duplicate atom id: ${a.id}`)
    ids.add(a.id)
    if (typeof a.element !== 'string' || !a.element.trim()) return fail(`atom ${a.id}: element missing`)
    if (!isFinitePos(a.fractionalPosition)) return fail(`atom ${a.id}: fractionalPosition must be 3 finite numbers`)
    atoms.push({ id: a.id, element: a.element.trim(), fractionalPosition: [...a.fractionalPosition] as Vec3 })
  }
  if (!Array.isArray(d.neighborRules)) return fail('neighborRules must be an array')
  const neighborRules: NeighborRule[] = []
  for (const raw of d.neighborRules as unknown[]) {
    const r = raw as Record<string, unknown>
    const els = r?.elements as unknown
    if (!Array.isArray(els) || els.length !== 2 || !els.every((e) => typeof e === 'string' && e)) return fail('neighborRule.elements must be two element symbols')
    if (typeof r.maxDistance !== 'number' || !Number.isFinite(r.maxDistance) || r.maxDistance <= 0) return fail('neighborRule.maxDistance must be > 0')
    neighborRules.push({ elements: [els[0], els[1]], maxDistance: r.maxDistance })
  }
  let params: Record<string, number> | undefined
  if (d.params !== undefined) {
    if (!d.params || typeof d.params !== 'object') return fail('params must be an object')
    params = {}
    for (const [k, v] of Object.entries(d.params as Record<string, unknown>)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`params.${k} must be a finite number`)
      params[k] = v
    }
  }
  const representation: AtomRepresentation = rep.kind === 'motif' ? { kind: 'motif', centering: rep.centering as Centering, atoms } : { kind: 'cellSites', atoms }
  const provenance = d.provenance as DraftProvenance | undefined
  if (provenance !== undefined) {
    if (!provenance || typeof provenance !== 'object' || typeof provenance.exampleId !== 'string' || typeof provenance.sourceRevision !== 'string' || typeof provenance.copiedAt !== 'string') return fail('invalid provenance')
  }
  return {
    ok: true,
    doc: {
      format: DRAFT_FORMAT,
      schemaVersion: 1,
      id: d.id,
      title: (d.title as string | null | undefined) ?? null,
      provenance,
      cell: { a: cellParams.a, b: cellParams.b, c: cellParams.c, alpha: cellParams.alpha, beta: cellParams.beta, gamma: cellParams.gamma },
      lengthUnit: d.lengthUnit,
      cellSetting: d.cellSetting,
      representation,
      geometryConstraint: d.geometryConstraint as GeometryConstraint,
      neighborRules,
      scientificStatus: 'custom-unverified',
      params,
    },
  }
}
