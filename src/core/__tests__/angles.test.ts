import { describe, expect, it } from 'vitest'
import { cellAngleMarks, formatDegrees } from '../angles'
import { cellToBasis } from '../lattice'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'
import type { Vec3 } from '../types'

const system = (id: string) => CRYSTAL_SYSTEMS.find((s) => s.id === id)!
const norm = (p: Vec3) => Math.hypot(...p)

describe('cellAngleMarks', () => {
  it('reports α, β, γ equal to the cell parameters in every crystal system', () => {
    for (const s of CRYSTAL_SYSTEMS) {
      const [alpha, beta, gamma] = cellAngleMarks(cellToBasis(s.cell), 0.3)
      expect(alpha.degrees).toBeCloseTo(s.cell.alpha, 6)
      expect(beta.degrees).toBeCloseTo(s.cell.beta, 6)
      expect(gamma.degrees).toBeCloseTo(s.cell.gamma, 6)
    }
  })

  it('draws a right-angle marker for 90° and an arc otherwise', () => {
    const [alpha, beta, gamma] = cellAngleMarks(cellToBasis(system('hexagonal').cell), 0.3)
    expect(alpha.isRightAngle && beta.isRightAngle).toBe(true)
    expect(alpha.path).toHaveLength(3)
    expect(gamma.isRightAngle).toBe(false)
    expect(gamma.arrowheads).toHaveLength(4)
  })

  it('keeps every arc point at the arc radius, in the plane of the two lattice vectors', () => {
    const basis = cellToBasis(system('triclinic').cell)
    const [alpha] = cellAngleMarks(basis, 0.3)
    // b⃗ × c⃗ 為 α 所在平面的法向量
    const { b, c } = basis
    const n: Vec3 = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]]
    for (const p of alpha.path) {
      expect(norm(p)).toBeCloseTo(0.3, 9)
      expect((p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / norm(n)).toBeCloseTo(0, 9)
    }
  })

  it('formats degrees without trailing zeros', () => {
    expect(formatDegrees(120)).toBe('120°')
    expect(formatDegrees(104.9999999)).toBe('105°')
    expect(formatDegrees(70.25)).toBe('70.3°')
  })
})
