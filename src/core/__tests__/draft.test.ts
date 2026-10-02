import { describe, expect, it } from 'vitest'
import { findExample } from '../../data/examples'
import { buildMotif, defaultParams } from '../../data/types'
import { copyStructure, createDraftMeta } from '../draft'
import { generateImages, imageCellPosition } from '../periodic'

describe('設計草稿：資料隔離', () => {
  it('複製後修改草稿，教學範例物件不變', () => {
    const example = findExample('fcc-cu')
    const before = structuredClone({ cell: example.cell, motif: buildMotif(example, defaultParams(example)) })
    const draft = copyStructure(example.cell, buildMotif(example, defaultParams(example)), defaultParams(example))
    draft.cell.a = 9
    draft.basis[0].element = 'Au'
    draft.basis[0].fractionalPosition[0] = 0.3
    expect(example.cell).toEqual(before.cell)
    expect(buildMotif(example, defaultParams(example))).toEqual(before.motif)
  })

  it('草稿中繼資料記錄來源與時間，狀態為未驗證', () => {
    const meta = createDraftMeta('fcc-cu', '1.3.0', new Date('2026-10-03T00:00:00Z'))
    expect(meta.provenance).toEqual({ exampleId: 'fcc-cu', sourceRevision: '1.3.0', copiedAt: '2026-10-03T00:00:00.000Z' })
    expect(meta.scientificStatus).toBe('custom-unverified')
    expect(meta.title).toBeNull()
  })
})

describe('FIX-01：α-U 資訊卡座標', () => {
  it('C 平移後的第一顆原子：晶胞內 (0.5, 0.6025, 0.25)，原始基元仍為 (0, 0.1025, 0.25)', () => {
    const example = findExample('alpha-u')
    const basis = buildMotif(example, { y: 0.1025 })
    const images = generateImages(basis, { repeatA: 1, repeatB: 1, repeatC: 1, showBoundaryImages: false }, 'C')
    const translated = images.find((img) => img.baseId === 'u-1' && img.kind === 'base')
    expect(translated).toBeDefined()
    const cellPos = imageCellPosition(translated!)
    expect(cellPos[0]).toBeCloseTo(0.5, 6)
    expect(cellPos[1]).toBeCloseTo(0.6025, 6)
    expect(cellPos[2]).toBeCloseTo(0.25, 6)
    expect(basis[0].fractionalPosition).toEqual([0, 0.1025, 0.25])
    expect(basis[0].positionLabel).toBe('(0, y, ¼)')
  })
})
