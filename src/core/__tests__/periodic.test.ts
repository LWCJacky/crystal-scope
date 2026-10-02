import { describe, expect, it } from 'vitest'
import { generateCellEdges, generateImages, generateLatticePoints, wrapFraction, wrapPosition } from '../periodic'
import type { BasisAtom, RepeatSettings } from '../types'

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

  it('clamps repeat counts to 1…5', () => {
    expect(generateImages([atoms[1]], repeat(9))).toHaveLength(125)
    expect(generateImages([atoms[1]], repeat(0))).toHaveLength(1)
  })
})

describe('lattice points and cell edges', () => {
  it('generates (N+1)³ lattice points', () => {
    expect(generateLatticePoints(repeat(2))).toHaveLength(27)
  })

  it('generates 12 edges for a single cell and 3·(N+1)² block-spanning lines for an N³ block', () => {
    expect(generateCellEdges(repeat(1))).toHaveLength(12)
    expect(generateCellEdges(repeat(2))).toHaveLength(3 * 9)
  })
})
