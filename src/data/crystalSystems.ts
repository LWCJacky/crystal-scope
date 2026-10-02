import type { L10n } from '../i18n/types'
import { C, F, I, P } from './lattices'
import type { StructureExample } from './types'

const t = (zh: string, en: string, ja: string): L10n => ({ 'zh-TW': zh, en, ja })

/** 每個範例均為「原點單一原子」的基底，再依所選布拉菲晶格的心型平移；原子僅為示意，晶格點與原子在檢視中另行區分。 */
const originAtom = () => [{ id: 'atom-1', element: 'X', fractionalPosition: [0, 0, 0] as [number, number, number] }]

const conventional = t('慣用晶胞', 'Conventional cell', '慣用単位格子')

export const CRYSTAL_SYSTEMS: StructureExample[] = [
  {
    id: 'triclinic',
    group: 'system',
    systemId: 'triclinic',
    lengthUnit: '示意',
    name: t('三斜', 'Triclinic', '三斜'),
    nameEn: 'Triclinic',
    cellSetting: conventional,
    lattices: [P('a')],
    relations: t('a ≠ b ≠ c；α ≠ β ≠ γ', 'a ≠ b ≠ c; α ≠ β ≠ γ', 'a ≠ b ≠ c；α ≠ β ≠ γ'),
    description: t(
      '對稱性最低的晶系，三個邊長與三個夾角一般皆不相等。',
      'The least symmetric system: all three edge lengths and all three angles are in general different.',
      '最も対称性の低い晶系。三つの辺長と三つの角は一般にすべて異なります。',
    ),
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 80, beta: 95, gamma: 105 },
    motif: originAtom(),
  },
  {
    id: 'monoclinic',
    group: 'system',
    systemId: 'monoclinic',
    lengthUnit: '示意',
    name: t('單斜', 'Monoclinic', '単斜'),
    nameEn: 'Monoclinic',
    cellSetting: t('慣用晶胞，b 為唯一軸', 'Conventional cell, unique axis b', '慣用単位格子、唯一軸は b'),
    lattices: [P('m'), C('m')],
    relations: t('a ≠ b ≠ c；α = γ = 90°，β ≠ 90°', 'a ≠ b ≠ c; α = γ = 90°, β ≠ 90°', 'a ≠ b ≠ c；α = γ = 90°、β ≠ 90°'),
    description: t(
      '具有一個二次旋轉軸或鏡面；本範例以 b 軸為唯一軸。',
      'Has one two-fold rotation axis or mirror plane; this example uses b as the unique axis.',
      '2 回回転軸または鏡面を一つ持ちます。この例では b 軸を唯一軸とします。',
    ),
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 90, beta: 105, gamma: 90 },
    motif: originAtom(),
  },
  {
    id: 'orthorhombic',
    group: 'system',
    systemId: 'orthorhombic',
    lengthUnit: '示意',
    name: t('斜方', 'Orthorhombic', '斜方'),
    nameEn: 'Orthorhombic',
    cellSetting: conventional,
    lattices: [P('o'), C('o'), I('o'), F('o')],
    relations: t('a ≠ b ≠ c；α = β = γ = 90°', 'a ≠ b ≠ c; α = β = γ = 90°', 'a ≠ b ≠ c；α = β = γ = 90°'),
    description: t(
      '三個互相垂直但長度不同的晶格向量。',
      'Three mutually perpendicular lattice vectors of different lengths.',
      '互いに直交し、長さの異なる三つの格子ベクトル。',
    ),
    cell: { a: 1.0, b: 1.2, c: 1.4, alpha: 90, beta: 90, gamma: 90 },
    motif: originAtom(),
  },
  {
    id: 'tetragonal',
    group: 'system',
    systemId: 'tetragonal',
    lengthUnit: '示意',
    name: t('四方', 'Tetragonal', '正方'),
    nameEn: 'Tetragonal',
    cellSetting: conventional,
    lattices: [P('t'), I('t')],
    relations: t('a = b ≠ c；α = β = γ = 90°', 'a = b ≠ c; α = β = γ = 90°', 'a = b ≠ c；α = β = γ = 90°'),
    description: t(
      '具有一個四次旋轉軸，沿 c 軸方向。',
      'Has one four-fold rotation axis, along c.',
      'c 軸に沿った 4 回回転軸を一つ持ちます。',
    ),
    cell: { a: 1.0, b: 1.0, c: 1.4, alpha: 90, beta: 90, gamma: 90 },
    motif: originAtom(),
  },
  {
    id: 'trigonal',
    group: 'system',
    systemId: 'trigonal',
    lengthUnit: '示意',
    name: t('三方', 'Trigonal', '三方'),
    nameEn: 'Trigonal',
    cellSetting: t(
      '菱方晶格 hR，採菱面體軸（rhombohedral axes）設定',
      'Rhombohedral lattice hR, rhombohedral-axes setting',
      '菱面体格子 hR、菱面体軸設定',
    ),
    // 菱面體軸設定下 hR 為簡單晶胞，故心型為 P
    lattices: [{ symbol: 'hR', centering: 'P', nameKey: 'lattice.R', nameEn: 'Rhombohedral' }],
    relations: t('此設定下 a = b = c；α = β = γ ≠ 90°', 'In this setting a = b = c; α = β = γ ≠ 90°', 'この設定では a = b = c；α = β = γ ≠ 90°'),
    description: t(
      '三方晶系的特徵是一個三次旋轉軸。三方晶系可具菱方晶格 hR 或六方晶格 hP；此處僅示範 hR 晶格的菱面體軸設定，此外形不代表所有三方結構。',
      'The trigonal system is characterised by one three-fold rotation axis. Trigonal crystals may have a rhombohedral (hR) or hexagonal (hP) lattice; only the rhombohedral-axes setting of hR is shown here, and this shape does not represent every trigonal structure.',
      '三方晶系の特徴は 3 回回転軸を一つ持つことです。三方晶系は菱面体格子 hR または六方格子 hP を取りえます。ここでは hR 格子の菱面体軸設定のみを示しており、この形がすべての三方晶構造を代表するわけではありません。',
    ),
    cell: { a: 1.0, b: 1.0, c: 1.0, alpha: 70, beta: 70, gamma: 70 },
    motif: originAtom(),
  },
  {
    id: 'hexagonal',
    group: 'system',
    systemId: 'hexagonal',
    lengthUnit: '示意',
    name: t('六方', 'Hexagonal', '六方'),
    nameEn: 'Hexagonal',
    cellSetting: t('慣用晶胞（三指數表示）', 'Conventional cell (three-index notation)', '慣用単位格子（三指数表記）'),
    lattices: [P('h')],
    relations: t('a = b ≠ c；α = β = 90°，γ = 120°', 'a = b ≠ c; α = β = 90°, γ = 120°', 'a = b ≠ c；α = β = 90°、γ = 120°'),
    description: t(
      '具有一個六次旋轉軸，沿 c 軸方向。四指數 [uvtw] 表示列為後續功能。',
      'Has one six-fold rotation axis, along c. Four-index [uvtw] notation is planned for a later version.',
      'c 軸に沿った 6 回回転軸を一つ持ちます。四指数 [uvtw] 表記は今後の機能です。',
    ),
    cell: { a: 1.0, b: 1.0, c: 1.6, alpha: 90, beta: 90, gamma: 120 },
    motif: originAtom(),
  },
  {
    id: 'cubic',
    group: 'system',
    systemId: 'cubic',
    lengthUnit: '示意',
    name: t('立方', 'Cubic', '立方'),
    nameEn: 'Cubic',
    cellSetting: conventional,
    lattices: [P('c'), I('c'), F('c')],
    relations: t('a = b = c；α = β = γ = 90°', 'a = b = c; α = β = γ = 90°', 'a = b = c；α = β = γ = 90°'),
    description: t(
      '對稱性最高的晶系，具有四個三次旋轉軸（沿體對角線）。',
      'The most symmetric system, with four three-fold rotation axes (along the body diagonals).',
      '最も対称性の高い晶系で、体対角線に沿った 3 回回転軸を四つ持ちます。',
    ),
    cell: { a: 1.0, b: 1.0, c: 1.0, alpha: 90, beta: 90, gamma: 90 },
    motif: originAtom(),
  },
]
