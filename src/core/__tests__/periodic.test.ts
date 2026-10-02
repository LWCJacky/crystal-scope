import { describe, expect, it } from 'vitest'
import { clampRepeat, generateCellEdges, generateImages, generateLatticePoints, wrapFraction, wrapPosition } from '../periodic'
import type { Centering } from '../centering'
import type { BasisAtom, RepeatSettings } from '../types'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'

const repeat = (n: number, showBoundaryImages = false): RepeatSettings => ({
  repeatA: n,
  repeatB: n,
  repeatC: n,
  showBoundaryImages,
})

describe('wrapFraction', () => {
  it('wraps into [0, 1)', () => {
    expect(wrapFraction(0.25)).toBe(0.25)
    expect(wrapFraction(1.25)).toBeCloseTo(0.25)
    expect(wrapFraction(-0.25)).toBeCloseTo(0.75)
    expect(wrapFraction(3)).toBe(0)
  })

  it('normalises 1 and near-1 values to 0 so the boundary is never stored twice', () => {
    expect(wrapFraction(1)).toBe(0)
    expect(wrapFraction(1 - 1e-12)).toBe(0)
    expect(Object.is(wrapFraction(-0), 0)).toBe(true)
  })

  it('treats positions at 0 and 1 as the same stored coordinate', () => {
    expect(wrapPosition([1, 0, 1])).toEqual(wrapPosition([0, 0, 0]))
  })
})

describe('generateImages', () => {
  const atoms: BasisAtom[] = [
    { id: 'corner', element: 'A', fractionalPosition: [0, 0, 0] },
    { id: 'center', element: 'B', fractionalPosition: [0.5, 0.5, 0.5] },
  ]

  it('creates exactly Na·Nb·Nc images per basis atom without boundary images', () => {
    const images = generateImages(atoms, { repeatA: 2, repeatB: 3, repeatC: 1, showBoundaryImages: false })
    expect(images.filter((i) => i.baseId === 'corner')).toHaveLength(6)
    expect(images.filter((i) => i.baseId === 'center')).toHaveLength(6)
    expect(images.every((i) => !i.isBoundaryImage)).toBe(true)
  })

  it('adds boundary images only for atoms on the boundary and flags them', () => {
    const images = generateImages(atoms, repeat(1, true))
    const corner = images.filter((i) => i.baseId === 'corner')
    expect(corner).toHaveLength(8) // 立方體 8 個角
    expect(corner.filter((i) => !i.isBoundaryImage)).toHaveLength(1)
    expect(images.filter((i) => i.baseId === 'center')).toHaveLength(1)
  })

  it('places every image at base position + integer offset', () => {
    for (const img of generateImages(atoms, repeat(3, true))) {
      const base = atoms.find((a) => a.id === img.baseId)!.fractionalPosition
      img.fractionalPosition.forEach((v, i) => expect(v).toBeCloseTo(base[i] + img.offset[i]))
    }
  })

  it('follows edits to the basis atom (periodic sync)', () => {
    const edited: BasisAtom[] = [{ ...atoms[1], fractionalPosition: [0.1, 0.2, 0.3] }]
    const images = generateImages(edited, repeat(2))
    expect(images).toHaveLength(8)
    for (const img of images) {
      expect(img.fractionalPosition[0] - img.offset[0]).toBeCloseTo(0.1)
      expect(img.fractionalPosition[1] - img.offset[1]).toBeCloseTo(0.2)
      expect(img.fractionalPosition[2] - img.offset[2]).toBeCloseTo(0.3)
    }
  })

  it('wraps out-of-range stored coordinates instead of duplicating them', () => {
    const images = generateImages([{ id: 'x', element: 'A', fractionalPosition: [1, 1.5, -0.5] }], repeat(1))
    expect(images).toHaveLength(1)
    expect(images[0].fractionalPosition).toEqual([0, 0.5, 0.5])
  })

  it('honours any repeat count (the 1…5 limit belongs to the UI slider only)', () => {
    expect(generateImages([atoms[1]], repeat(11))).toHaveLength(1331)
    expect(generateImages([atoms[1]], repeat(0))).toHaveLength(1)
    expect(clampRepeat(9)).toBe(5)
    expect(clampRepeat(0)).toBe(1)
  })
})

describe('lattice points and cell edges', () => {
  it('generates (N+1)³ lattice points including boundary images', () => {
    expect(generateLatticePoints(repeat(2, true))).toHaveLength(27)
    expect(generateLatticePoints(repeat(2)).filter((p) => !p.isBoundaryImage)).toHaveLength(8)
  })

  it('generates 12 edges for a single cell and 3·(N+1)² block-spanning lines for an N³ block', () => {
    expect(generateCellEdges(repeat(1))).toHaveLength(12)
    expect(generateCellEdges(repeat(2))).toHaveLength(3 * 9)
  })
})

describe('centering', () => {
  const origin: BasisAtom[] = [{ id: 'o', element: 'A', fractionalPosition: [0, 0, 0] }]
  const inCell = (centering: Centering) =>
    generateImages(origin, repeat(1, true), centering).filter((i) => !i.isBoundaryImage)

  it('gives 1, 2, 2, 4 lattice points per cell for P, C, I, F', () => {
    expect(inCell('P')).toHaveLength(1)
    expect(inCell('C')).toHaveLength(2)
    expect(inCell('I')).toHaveLength(2)
    expect(inCell('F')).toHaveLength(4)
  })

  it('tags half-position points with their kind', () => {
    const body = inCell('I').find((i) => i.kind === 'body')!
    expect(body.fractionalPosition).toEqual([0.5, 0.5, 0.5])
    expect(inCell('C').find((i) => i.kind === 'base')!.fractionalPosition).toEqual([0.5, 0.5, 0])
    expect(inCell('F').filter((i) => i.kind === 'face')).toHaveLength(3)
  })

  it('shows all 6 face centres and 8 corners of an FCC cell with boundary images', () => {
    const all = generateLatticePoints(repeat(1, true), 'F')
    expect(all.filter((p) => p.kind === 'face')).toHaveLength(6)
    expect(all.filter((p) => p.kind === 'corner')).toHaveLength(8)
  })

  it('keeps body centres inside the cell (no boundary images)', () => {
    expect(generateLatticePoints(repeat(2, true), 'I').filter((p) => p.kind === 'body')).toHaveLength(8)
  })
})

describe('Bravais lattices', () => {
  it('lists exactly 14 types across the seven crystal systems', () => {
    expect(CRYSTAL_SYSTEMS.flatMap((s) => s.lattices.map((l) => l.symbol))).toHaveLength(14)
  })
})

describe('generateImages with margin (clip-to-cell)', () => {
  it('includes one extra cell on every side and flags everything outside the block as boundary', () => {
    const atoms: BasisAtom[] = [{ id: 'm', element: 'A', fractionalPosition: [0.3, 0.3, 0.3] }]
    const images = generateImages(atoms, repeat(1), 'P', 1)
    expect(images).toHaveLength(27)
    expect(images.filter((i) => !i.isBoundaryImage)).toHaveLength(1)
    expect(images.some((i) => i.offset[0] === -1)).toBe(true)
  })
})
