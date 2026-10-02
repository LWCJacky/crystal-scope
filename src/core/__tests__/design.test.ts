import { describe, expect, it } from 'vitest'
import { findExample } from '../../data/examples'
import { buildMotif, defaultParams } from '../../data/types'
import { applyGeometryConstraint, constrainedKeys, expandToCellSites, nextAtomId, parseDesignDocument, siteConflicts, type DesignDocument } from '../design'
import { validateCell } from '../lattice'
import { generateImages } from '../periodic'
import { EditHistory } from '../history'

const key = (p: number[]) => p.map((v) => v.toFixed(6)).join(',')

describe('表示方式等價（規格 8.1 #2）', () => {
  it('FCC 的 F + 1 原子展開為 4 顆 cellSites，展開結果與原本相同且不再套第二次 F', () => {
    const fcc = findExample('fcc-cu')
    const motif = buildMotif(fcc, defaultParams(fcc))
    const sites = expandToCellSites(motif, 'F')
    expect(sites).toHaveLength(4)
    expect(new Set(sites.map((a) => a.id)).size).toBe(4)
    const repeat = { repeatA: 2, repeatB: 2, repeatC: 2, showBoundaryImages: false }
    const fromMotif = generateImages(motif, repeat, 'F').map((i) => key(i.fractionalPosition)).sort()
    const fromSites = generateImages(sites, repeat, 'P').map((i) => key(i.fractionalPosition)).sort()
    expect(fromSites).toEqual(fromMotif)
    expect(fromSites).toHaveLength(32)
  })
})

describe('幾何約束', () => {
  it('cubic 連動 b、c 與三個角；free 不改動', () => {
    const cell = { a: 3, b: 4, c: 5, alpha: 80, beta: 85, gamma: 95 }
    expect(applyGeometryConstraint(cell, 'cubic')).toEqual({ a: 3, b: 3, c: 3, alpha: 90, beta: 90, gamma: 90 })
    expect(applyGeometryConstraint(cell, 'free')).toEqual(cell)
    expect(constrainedKeys('hexagonal').sort()).toEqual(['alpha', 'b', 'beta', 'gamma'])
  })
})

describe('非法晶胞（規格 8.1 #4）', () => {
  it('三角皆 130° 被拒絕', () => {
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 130, beta: 130, gamma: 130 }).valid).toBe(false)
  })
})

describe('同位置原子', () => {
  it('週期等價（0 與 1）視為同位置；同元素與不同元素分開回報', () => {
    const atoms = [
      { id: 'a', element: 'Na', fractionalPosition: [0, 0, 0] as [number, number, number] },
      { id: 'b', element: 'Na', fractionalPosition: [1, 0, 0] as [number, number, number] },
      { id: 'c', element: 'Cl', fractionalPosition: [0.5, 0.5, 0.5] as [number, number, number] },
      { id: 'd', element: 'K', fractionalPosition: [0.5, 0.5, 0.5] as [number, number, number] },
    ]
    expect(siteConflicts(atoms)).toEqual([
      { a: 'a', b: 'b', sameElement: true },
      { a: 'c', b: 'd', sameElement: false },
    ])
    expect(nextAtomId(atoms, 'Na')).toBe('na-5')
  })
})

describe('草稿 JSON 驗證（規格 8.1 #12）', () => {
  const good: DesignDocument = {
    schemaVersion: 1,
    id: 'd1',
    title: null,
    cell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 },
    lengthUnit: 'angstrom',
    cellSetting: 'conventional',
    representation: { kind: 'cellSites', atoms: [{ id: 'x1', element: 'Cu', fractionalPosition: [0, 0, 0] }] },
    geometryConstraint: 'free',
    neighborRules: [{ elements: ['Cu', 'Cu'], maxDistance: 2.9 }],
    scientificStatus: 'custom-unverified',
  }
  it('合法文件往返保留結構與單位', () => {
    const r = parseDesignDocument(JSON.parse(JSON.stringify(good)))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.doc).toEqual(good)
  })
  it.each([
    ['未知版本', { ...good, schemaVersion: 2 }, 'schemaVersion'],
    ['NaN', { ...good, cell: { ...good.cell, a: Number.NaN } }, 'cell.a'],
    ['無限值', { ...good, representation: { kind: 'cellSites', atoms: [{ id: 'x1', element: 'Cu', fractionalPosition: [Infinity, 0, 0] }] } }, 'fractionalPosition'],
    ['非法晶胞', { ...good, cell: { a: 1, b: 1, c: 1, alpha: 130, beta: 130, gamma: 130 } }, 'invalid cell'],
    ['重複 ID', { ...good, representation: { kind: 'cellSites', atoms: [{ id: 'x1', element: 'Cu', fractionalPosition: [0, 0, 0] }, { id: 'x1', element: 'Cu', fractionalPosition: [0.5, 0.5, 0.5] }] } }, 'duplicate'],
    ['缺元素', { ...good, representation: { kind: 'cellSites', atoms: [{ id: 'x1', element: '', fractionalPosition: [0, 0, 0] }] } }, 'element'],
    ['motif 無心型', { ...good, representation: { kind: 'motif', atoms: [] } }, 'centering'],
  ])('%s → 明確錯誤', (_name, doc, needle) => {
    const r = parseDesignDocument(doc)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(needle)
  })
})

describe('歷史紀錄（規格 8.1 #11）', () => {
  it('一段連續拖曳只佔一步 undo；redo 還原', () => {
    const h = new EditHistory<number>()
    h.begin(0)
    h.begin(1) // 同一段拖曳內不重複記錄
    h.begin(2)
    h.end()
    expect(h.canUndo).toBe(true)
    expect(h.undo(3)).toBe(0)
    expect(h.canUndo).toBe(false)
    expect(h.redo(0)).toBe(3)
    h.record(3)
    expect(h.undo(4)).toBe(3)
    expect(h.canRedo).toBe(true)
    h.record(9) // 新操作清掉 redo
    expect(h.canRedo).toBe(false)
  })
})
