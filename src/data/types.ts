import type { Centering } from '../core/centering'
import type { BasisAtom, CellParams, CrystalSystemId } from '../core/types'

/** 布拉菲晶格類型；七大晶系合計 14 種。 */
export interface BravaisLattice {
  /** 皮爾遜符號，例如 cF。 */
  symbol: string
  centering: Centering
  nameZh: string
  nameEn: string
}

/** 基元內部的自由參數，例如 α-U 的 y。 */
export interface MotifParameter {
  key: string
  min: number
  max: number
  step: number
  /** 參考文獻值；偏離時結構標示為自訂。 */
  default: number
  note: string
}

/** 鍵／最近鄰連線規則：兩元素間距離 ≤ maxDistance 才連線（單位同晶胞長度）。 */
export interface BondRule {
  elements: [string, string]
  maxDistance: number
}

export type MotifParams = Record<string, number>

export interface StructureExample {
  id: string
  /** system：七大晶系示意晶胞；material：投影片中的真實材料範例。 */
  group: 'system' | 'material'
  systemId: CrystalSystemId
  nameZh: string
  nameEn: string
  /** 本範例採用的晶胞設定（必須明示，尤其三方晶系）。 */
  cellSetting: string
  /** 典型幾何關係的文字描述。 */
  relations: string
  description: string
  /** 可選的布拉菲晶格，第一個為預設；材料範例只有一個。 */
  lattices: BravaisLattice[]
  cell: CellParams
  lengthUnit: 'Å' | '示意'
  /** 基元：與「一個」晶格點相關聯的原子，座標相對於該晶格點。 */
  motif: BasisAtom[] | ((params: MotifParams) => BasisAtom[])
  parameters?: MotifParameter[]
  bonds?: BondRule[]
  /** 單一元素金屬：允許切換硬球接觸模型（半徑 = 最近鄰距離 / 2）。 */
  hardSphere?: boolean
  /** 多晶材料（金屬）：尺度之旅的巨觀物件為切開的金屬棒，切面顯示晶粒；否則以單晶外形呈現。 */
  polycrystalline?: boolean
  /** 資料來源或近似說明。 */
  reference?: string
}

export function defaultParams(example: StructureExample): MotifParams {
  return Object.fromEntries((example.parameters ?? []).map((p) => [p.key, p.default]))
}

export function buildMotif(example: StructureExample, params: MotifParams): BasisAtom[] {
  const motif = typeof example.motif === 'function' ? example.motif(params) : example.motif
  return structuredClone(motif)
}
