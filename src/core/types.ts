import type { LatticePointKind } from './centering'

export type Vec3 = [number, number, number]

/** 晶胞參數：長度為示意單位，角度為度。 */
export interface CellParams {
  a: number
  b: number
  c: number
  alpha: number
  beta: number
  gamma: number
}

/** 三個晶格向量 a⃗、b⃗、c⃗（直角座標）。 */
export interface LatticeBasis {
  a: Vec3
  b: Vec3
  c: Vec3
}

export interface BasisAtom {
  /** 穩定 ID，視覺複本以此關聯回基底原子。 */
  id: string
  element: string
  /** 分率座標，儲存時正規化至 [0,1)。 */
  fractionalPosition: Vec3
  color?: string
  /** 以符號表示的座標，例如 (0, y, ¼)；有內部參數時用於基元表。 */
  positionLabel?: string
  /** 示意顯示半徑，非真實原子半徑。 */
  displayRadius?: number
}

export interface RepeatSettings {
  repeatA: number
  repeatB: number
  repeatC: number
  /** 是否在晶胞外側邊界顯示淡色複本。 */
  showBoundaryImages: boolean
}

/** 由基底原子衍生的視覺複本，不寫回儲存。 */
export interface AtomImage {
  baseId: string
  /** 此複本由哪一種晶格點平移而來（角落、底心、體心、面心）。 */
  kind: LatticePointKind
  offset: Vec3
  fractionalPosition: Vec3
  /** 此複本所關聯的晶格點（分率座標），用於顯示 Lattice point ↔ Motif 連線。 */
  latticePoint: Vec3
  isBoundaryImage: boolean
}

export type CrystalSystemId =
  | 'triclinic'
  | 'monoclinic'
  | 'orthorhombic'
  | 'tetragonal'
  | 'trigonal'
  | 'hexagonal'
  | 'cubic'

export interface Direction {
  u: number
  v: number
  w: number
  /** 箭頭起點（分率座標）；平移起點不改變方向。 */
  origin: Vec3
  displayLength: number
}
