import type { BasisAtom, CellParams, CrystalSystemId } from '../core/types'

export interface CrystalSystemExample {
  id: CrystalSystemId
  nameZh: string
  nameEn: string
  /** 本範例採用的晶胞設定（必須明示，尤其三方晶系）。 */
  cellSetting: string
  /** 典型幾何關係的文字描述。 */
  relations: string
  description: string
  /** 示意參數，非特定真實材料。 */
  cell: CellParams
  basis: BasisAtom[]
}

/** 每個範例均為「簡單（P）晶格＋原點單一原子」，原子僅為示意，晶格點與原子在檢視中另行區分。 */
const originAtom = (): BasisAtom[] => [{ id: 'atom-1', element: 'X', fractionalPosition: [0, 0, 0] }]

export const CRYSTAL_SYSTEMS: CrystalSystemExample[] = [
  {
    id: 'triclinic',
    nameZh: '三斜',
    nameEn: 'Triclinic',
    cellSetting: '簡單三斜晶胞 aP',
    relations: 'a ≠ b ≠ c；α ≠ β ≠ γ',
    description: '對稱性最低的晶系，三個邊長與三個夾角一般皆不相等。',
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 80, beta: 95, gamma: 105 },
    basis: originAtom(),
  },
  {
    id: 'monoclinic',
    nameZh: '單斜',
    nameEn: 'Monoclinic',
    cellSetting: '簡單單斜晶胞 mP，b 為唯一軸',
    relations: 'a ≠ b ≠ c；α = γ = 90°，β ≠ 90°',
    description: '具有一個二次旋轉軸或鏡面；本範例以 b 軸為唯一軸。',
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 90, beta: 105, gamma: 90 },
    basis: originAtom(),
  },
  {
    id: 'orthorhombic',
    nameZh: '斜方',
    nameEn: 'Orthorhombic',
    cellSetting: '簡單斜方晶胞 oP',
    relations: 'a ≠ b ≠ c；α = β = γ = 90°',
    description: '三個互相垂直但長度不同的晶格向量。',
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 90, beta: 90, gamma: 90 },
    basis: originAtom(),
  },
  {
    id: 'tetragonal',
    nameZh: '四方',
    nameEn: 'Tetragonal',
    cellSetting: '簡單四方晶胞 tP',
    relations: 'a = b ≠ c；α = β = γ = 90°',
    description: '具有一個四次旋轉軸，沿 c 軸方向。',
    cell: { a: 1.0, b: 1.0, c: 1.4, alpha: 90, beta: 90, gamma: 90 },
    basis: originAtom(),
  },
  {
    id: 'trigonal',
    nameZh: '三方',
    nameEn: 'Trigonal',
    cellSetting: '菱方晶格 hR，採菱面體軸（rhombohedral axes）設定',
    relations: '此設定下 a = b = c；α = β = γ ≠ 90°',
    description:
      '三方晶系的特徵是一個三次旋轉軸。三方晶系可具菱方晶格 hR 或六方晶格 hP；此處僅示範 hR 晶格的菱面體軸設定，此外形不代表所有三方結構。',
    cell: { a: 1.0, b: 1.0, c: 1.0, alpha: 70, beta: 70, gamma: 70 },
    basis: originAtom(),
  },
  {
    id: 'hexagonal',
    nameZh: '六方',
    nameEn: 'Hexagonal',
    cellSetting: '簡單六方晶胞 hP（三指數表示）',
    relations: 'a = b ≠ c；α = β = 90°，γ = 120°',
    description: '具有一個六次旋轉軸，沿 c 軸方向。四指數 [uvtw] 表示列為後續功能。',
    cell: { a: 1.0, b: 1.0, c: 1.6, alpha: 90, beta: 90, gamma: 120 },
    basis: originAtom(),
  },
  {
    id: 'cubic',
    nameZh: '立方',
    nameEn: 'Cubic',
    cellSetting: '簡單立方晶胞 cP',
    relations: 'a = b = c；α = β = γ = 90°',
    description: '對稱性最高的晶系，具有四個三次旋轉軸（沿體對角線）。',
    cell: { a: 1.0, b: 1.0, c: 1.0, alpha: 90, beta: 90, gamma: 90 },
    basis: originAtom(),
  },
]

export function findSystem(id: CrystalSystemId): CrystalSystemExample {
  const found = CRYSTAL_SYSTEMS.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown crystal system: ${id}`)
  return found
}
