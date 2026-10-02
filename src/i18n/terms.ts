import type { L10n } from './types'

/**
 * 專業名詞：以英文原文為主。切換到其他語言時，介面以「在地譯名 (English)」顯示，
 * 讓學生能對照課本與文獻的英文術語。
 */
export const TERMS = {
  structure: { en: 'Structure', 'zh-TW': '結構', ja: '構造' },
  latticePoint: { en: 'Lattice point', 'zh-TW': '晶格點', ja: '格子点' },
  latticePoints: { en: 'Lattice points', 'zh-TW': '晶格點', ja: '格子点' },
  motif: { en: 'Motif', 'zh-TW': '基元', ja: 'モチーフ' },
  composition: { en: 'Structure = Lattice + Motif', 'zh-TW': '結構 = 晶格點 + 基元', ja: '構造 = 格子点 + モチーフ' },
  unitCell: { en: 'Unit cell', 'zh-TW': '晶胞', ja: '単位格子' },
  bravais: { en: 'Bravais lattice', 'zh-TW': '布拉菲晶格', ja: 'ブラベー格子' },
  crystalSystems: { en: 'Crystal systems', 'zh-TW': '七大晶系', ja: '七つの晶系' },
  structures: { en: 'Structures', 'zh-TW': '晶體結構範例', ja: '結晶構造の例' },
  hexagonal: { en: 'Hexagonal', 'zh-TW': '六方晶系', ja: '六方晶系' },
  assembly: { en: 'Assembly', 'zh-TW': '拼裝動畫', ja: '組み立てアニメーション' },
  motifParams: { en: 'Motif parameters', 'zh-TW': '基元內部參數', ja: 'モチーフの内部パラメータ' },
  spheresBonds: { en: 'Spheres & bonds', 'zh-TW': '球體與鍵', ja: '球と結合' },
  cellParams: { en: 'Cell parameters', 'zh-TW': '晶胞參數', ja: '格子定数' },
  repeat: { en: 'Repeat', 'zh-TW': '週期排列', ja: '周期配列' },
  atomPosition: { en: 'Fractional x, y, z', 'zh-TW': '原子位置', ja: '原子位置' },
  direction: { en: 'Direction [uvw]', 'zh-TW': '晶向', ja: '結晶方位' },
  display: { en: 'Display', 'zh-TW': '顯示', ja: '表示' },
  settings: { en: 'Settings', 'zh-TW': '設定', ja: '設定' },
  demo: { en: 'Demo', 'zh-TW': '演示', ja: 'デモ' },
  scaleJourney: { en: 'Scale journey', 'zh-TW': '尺度之旅', ja: 'スケールの旅' },
  hardSphere: { en: 'Hard-sphere model', 'zh-TW': '硬球接觸模型', ja: '剛体球モデル' },
  nearestNeighbour: { en: 'Nearest neighbour', 'zh-TW': '最近鄰', ja: '最近接' },
  fractional: { en: 'Fractional coordinates', 'zh-TW': '分率座標', ja: '分率座標' },
  boundaryImage: { en: 'Boundary image', 'zh-TW': '邊界複本', ja: '境界の周期像' },
  perspective: { en: 'Perspective', 'zh-TW': '透視', ja: '透視投影' },
  orthographic: { en: 'Orthographic', 'zh-TW': '正交', ja: '正射影' },
  tour: { en: 'Guided tour', 'zh-TW': '使用導覽', ja: '使い方ガイド' },
  polycrystal: { en: 'Polycrystal', 'zh-TW': '多晶', ja: '多結晶' },
  singleCrystal: { en: 'Single crystal', 'zh-TW': '單晶', ja: '単結晶' },
  grain: { en: 'Grain', 'zh-TW': '晶粒', ja: '結晶粒' },
} satisfies Record<string, L10n>

export type TermKey = keyof typeof TERMS
