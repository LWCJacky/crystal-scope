import type { CellParams, CrystalSystemId } from './types'

type CellKey = keyof CellParams

/**
 * 教學模式下，各晶系「典型晶胞設定」的幾何鎖定。
 * 值為數字表示固定值；值為鍵名表示跟隨該參數。
 * 注意：這是本專案所採的晶胞設定，不代表能由邊長與夾角反推晶系。
 */
const RULES: Record<CrystalSystemId, Partial<Record<CellKey, number | CellKey>>> = {
  triclinic: {},
  // 單斜：採 b 為唯一軸（unique axis b）設定
  monoclinic: { alpha: 90, gamma: 90 },
  orthorhombic: { alpha: 90, beta: 90, gamma: 90 },
  tetragonal: { b: 'a', alpha: 90, beta: 90, gamma: 90 },
  // 三方：採菱面體軸（rhombohedral axes）設定的 hR 晶格
  trigonal: { b: 'a', c: 'a', beta: 'alpha', gamma: 'alpha' },
  hexagonal: { b: 'a', alpha: 90, beta: 90, gamma: 120 },
  cubic: { b: 'a', c: 'a', alpha: 90, beta: 90, gamma: 90 },
}

/** 教學模式中不可直接編輯的參數。 */
export function lockedKeys(system: CrystalSystemId): CellKey[] {
  return Object.keys(RULES[system]) as CellKey[]
}

export function applyConstraints(system: CrystalSystemId, cell: CellParams): CellParams {
  const next = { ...cell }
  for (const [key, rule] of Object.entries(RULES[system]) as [CellKey, number | CellKey][]) {
    next[key] = typeof rule === 'number' ? rule : cell[rule]
  }
  return next
}
