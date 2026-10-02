import { describe, expect, it } from 'vitest'
import { generatePrismImages, hexagonalAxes, hexPrismEdges, isInsideHexPrism, toFourIndex } from '../hexagonal'
import { cellToBasis } from '../lattice'
import { MATERIALS } from '../../data/materials'
import { buildMotif, defaultParams } from '../../data/types'
import type { Vec3 } from '../types'

const hcp = MATERIALS.find((m) => m.id === 'hcp-mg')!
const graphite = MATERIALS.find((m) => m.id === 'graphite')!
const angle = (p: Vec3, q: Vec3) =>
  (Math.acos((p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (Math.hypot(...p) * Math.hypot(...q))) * 180) / Math.PI

describe('hexagonal prism', () => {
  it('contains the hexagon and nothing outside it', () => {
    expect(isInsideHexPrism([1, 1, 0], 1)).toBe(true)
    expect(isInsideHexPrism([0.5, -0.5, 0.5], 1)).toBe(true)
    expect(isInsideHexPrism([1, -1, 0], 1)).toBe(false)
    expect(isInsideHexPrism([0, 0, 1.1], 1)).toBe(false)
  })

  it('shows the textbook 17 atoms of the HCP prism (12 corners + 2 face centres + 3 interior)', () => {
    const images = generatePrismImages(buildMotif(hcp, defaultParams(hcp)), 1)
    expect(images).toHaveLength(17)
    expect(images.filter((i) => Math.abs(i.fractionalPosition[2] - 0.5) < 1e-9)).toHaveLength(3)
  })

  it('has 14 lattice points in a one-layer hP prism', () => {
    const point = [{ id: 'p', element: '', fractionalPosition: [0, 0, 0] as Vec3 }]
    expect(generatePrismImages(point, 1)).toHaveLength(14)
  })

  it('gives each graphite layer complete hexagonal rings (12 atoms per layer in a 2-layer prism)', () => {
    const images = generatePrismImages(buildMotif(graphite, defaultParams(graphite)), 1)
    const atZ = (z: number) => images.filter((i) => Math.abs(i.fractionalPosition[2] - z) < 1e-9).length
    expect(atZ(0)).toBe(atZ(1))
    expect(atZ(0.5)).toBeGreaterThan(0)
  })

  it('has 18 outline edges per layer stack', () => {
    expect(hexPrismEdges(1).outline).toHaveLength(18)
  })
})

describe('four-axis system', () => {
  it('places a1, a2, a3 at 120° to each other in the basal plane, with c perpendicular', () => {
    const { a1, a2, a3, c } = hexagonalAxes(cellToBasis(hcp.cell))
    expect(angle(a1, a2)).toBeCloseTo(120, 10)
    expect(angle(a2, a3)).toBeCloseTo(120, 10)
    expect(angle(a3, a1)).toBeCloseTo(120, 10)
    for (const v of [a1, a2, a3]) expect(angle(v, c)).toBeCloseTo(90, 10)
  })

  it('converts three-index directions to four-index with t = −(u + v)', () => {
    expect(toFourIndex(1, 0, 0)).toEqual([2 / 3, -1 / 3, -1 / 3, 0])
    expect(toFourIndex(1, 1, 0).map((x) => x * 3)).toEqual([1, 1, -2, 0])
    expect(toFourIndex(0, 0, 1)).toEqual([0, 0, -0, 1])
  })
})
