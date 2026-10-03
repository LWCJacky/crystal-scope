import { describe, expect, it } from 'vitest'
import { findExample } from '../../data/examples'
import { buildMotif, defaultParams } from '../../data/types'
import { expandToCellSites } from '../design'
import { gridLayers, unitCellEdges } from '../grid'
import { generateImages } from '../periodic'
import { computeStats, formatFormula } from '../stats'

const motifOf = (id: string) => {
  const e = findExample(id)
  return { example: e, basis: buildMotif(e, defaultParams(e)) }
}

describe('邊界計數（規格 8.1 #5、#6）', () => {
  it('SC 1×1×1 開邊界：8 個球心，有效原子 1；2×2×2：27 個球心，有效 8', () => {
    const { example, basis } = motifOf('cubic')
    const one = generateImages(basis, { repeatA: 1, repeatB: 1, repeatC: 1, showBoundaryImages: true }, 'P')
    expect(one).toHaveLength(8)
    const s1 = computeStats({ cell: example.cell, basis, centering: 'P', representation: 'motif', cells: 1, drawnPoints: one.length })
    expect(s1.effectiveAtoms).toBe(1)
    expect(s1.drawnPoints).toBe(8)
    const two = generateImages(basis, { repeatA: 2, repeatB: 2, repeatC: 2, showBoundaryImages: true }, 'P')
    expect(two).toHaveLength(27)
    const s2 = computeStats({ cell: example.cell, basis, centering: 'P', representation: 'motif', cells: 8, drawnPoints: two.length })
    expect(s2.effectiveAtoms).toBe(8)
  })

  it('FCC：每晶胞有效原子 4；1×1×1 開邊界 14 個球心', () => {
    const { example, basis } = motifOf('fcc-cu')
    const images = generateImages(basis, { repeatA: 1, repeatB: 1, repeatC: 1, showBoundaryImages: true }, 'F')
    expect(images).toHaveLength(14)
    const s = computeStats({ cell: example.cell, basis, centering: 'F', representation: 'motif', cells: 1, drawnPoints: images.length })
    expect(s.perCellAtoms).toBe(4)
    expect(s.effectiveAtoms).toBe(4)
    expect(s.formula).toBe('Cu')
    expect(s.perCellFormula).toBe('Cu₄')
    // 完整晶胞表示：4 顆 cellSites 同樣是 4，且不再乘心型
    const sites = expandToCellSites(basis, 'F')
    const s2 = computeStats({ cell: example.cell, basis: sites, centering: 'P', representation: 'cellSites', cells: 1, drawnPoints: 0 })
    expect(s2.perCellAtoms).toBe(4)
  })

  it('同元素同位置的重複只算一顆；化學式約分', () => {
    const { example } = motifOf('nacl')
    const basis = [
      { id: 'a', element: 'Na', fractionalPosition: [0, 0, 0] as [number, number, number] },
      { id: 'b', element: 'Na', fractionalPosition: [1, 0, 0] as [number, number, number] },
      { id: 'c', element: 'Cl', fractionalPosition: [0.5, 0.5, 0.5] as [number, number, number] },
    ]
    const s = computeStats({ cell: example.cell, basis, centering: 'P', representation: 'cellSites', cells: 2, drawnPoints: 0 })
    expect(s.duplicates).toBe(1)
    expect(s.perCellAtoms).toBe(2)
    expect(s.effectiveAtoms).toBe(4)
    expect(s.formula).toBe('NaCl')
    expect(formatFormula([{ element: 'Ba', count: 2 }, { element: 'Ti', count: 2 }, { element: 'O', count: 6 }], true)).toBe('BaTiO₃')
    expect(s.cellVolume).toBeCloseTo(example.cell.a ** 3, 6)
  })
})

describe('三層格線', () => {
  it('1×1×1：主晶胞 12 條、格線 0、外框與主晶胞重合', () => {
    const g = gridLayers({ repeatA: 1, repeatB: 1, repeatC: 1 })
    expect(g.cell).toHaveLength(12)
    expect(g.grid).toHaveLength(0)
    expect(g.frame).toHaveLength(12)
    expect(g.frameDuplicatesCell).toBe(true)
    expect(unitCellEdges()).toHaveLength(12)
  })
  it('2×2×2：外框 12 條、格線 15 條，與主晶胞重合的線段從 1 開始', () => {
    const g = gridLayers({ repeatA: 2, repeatB: 2, repeatC: 2 })
    expect(g.frame).toHaveLength(12)
    expect(g.grid).toHaveLength(15)
    expect(g.frameDuplicatesCell).toBe(false)
    // 沿 x 軸、位於 y=0,z=0 的外框線是主晶胞邊的延伸：只保留 [1,2]
    const xAxisOrigin = g.frame.find(([s, e]) => s[1] === 0 && s[2] === 0 && e[1] === 0 && e[2] === 0)
    expect(xAxisOrigin).toEqual([[1, 0, 0], [2, 0, 0]])
    // 任一格線段都不與主晶胞邊重合
    const cellKeys = new Set(g.cell.map(([s, e]) => `${s}-${e}`))
    expect([...g.grid, ...g.frame].some(([s, e]) => cellKeys.has(`${s}-${e}`))).toBe(false)
  })
  it('3×3×3：格線 36 條', () => {
    expect(gridLayers({ repeatA: 3, repeatB: 3, repeatC: 3 }).grid).toHaveLength(36)
  })
})
