import { latticePointsPerCell, type Centering } from './centering'
import { siteConflicts, type Representation } from './design'
import { cellVolume } from './lattice'
import type { BasisAtom, CellParams } from './types'

export interface StructureStats {
  cellVolume: number
  /** 展示區塊的晶胞數（一般 Na×Nb×Nc；六方柱 3×Nc）。 */
  cells: number
  blockVolume: number
  /** 每晶胞有效原子數：去重且滿占位。 */
  perCell: { element: string; count: number }[]
  perCellAtoms: number
  /** 有效總原子數 = 每晶胞有效原子數 × 晶胞數；不由含邊界影像的渲染清單累加。 */
  effectiveAtoms: number
  /** 球心位於展示區的繪製點數（含邊界複本、不含裁切支援影像）；由呼叫端自渲染清單傳入。 */
  drawnPoints: number
  /** 同元素同位置的重複（已自有效數扣除）。 */
  duplicates: number
  /** 約分後的組成，例如 NaCl、BaTiO₃。 */
  formula: string
  /** 未約分的每晶胞組成，例如 Na₄Cl₄。 */
  perCellFormula: string
}

export interface StatsInput {
  cell: CellParams
  basis: readonly BasisAtom[]
  centering: Centering
  representation: Representation
  cells: number
  drawnPoints: number
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n: number) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => SUB[+d]))
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

export function formatFormula(counts: { element: string; count: number }[], reduce: boolean): string {
  const nonzero = counts.filter((c) => c.count > 0)
  if (!nonzero.length) return ''
  const g = reduce ? nonzero.reduce((acc, c) => gcd(acc, c.count), 0) : 1
  return nonzero.map((c) => `${c.element}${sub(c.count / g)}`).join('')
}

export function computeStats({ cell, basis, centering, representation, cells, drawnPoints }: StatsInput): StructureStats {
  const perPoint = representation === 'motif' ? latticePointsPerCell(centering) : 1
  // 同元素同位置：只算一顆（不同元素同位置屬衝突，另行警告，這裡照列）
  const duplicates = representation === 'cellSites' ? siteConflicts(basis).filter((c) => c.sameElement).length : 0
  const skip = new Set<string>()
  if (duplicates) for (const c of siteConflicts(basis)) if (c.sameElement) skip.add(c.b)
  const counts = new Map<string, number>()
  for (const atom of basis) {
    if (skip.has(atom.id)) continue
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + perPoint)
  }
  const perCell = [...counts.entries()].map(([element, count]) => ({ element, count }))
  const perCellAtoms = perCell.reduce((s, c) => s + c.count, 0)
  const v = cellVolume(cell)
  return {
    cellVolume: v,
    cells,
    blockVolume: v * cells,
    perCell,
    perCellAtoms,
    effectiveAtoms: perCellAtoms * cells,
    drawnPoints,
    duplicates,
    formula: formatFormula(perCell, true),
    perCellFormula: formatFormula(perCell, false),
  }
}
