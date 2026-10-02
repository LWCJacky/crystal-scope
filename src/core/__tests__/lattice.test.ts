import { describe, expect, it } from 'vitest'
import { cartToFrac, cellToBasis, cellVolume, fracToCart, validateCell } from '../lattice'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'
import type { Vec3 } from '../types'

const norm = (v: Vec3) => Math.hypot(...v)
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
const angleDeg = (p: Vec3, q: Vec3) => (Math.acos(dot(p, q) / (norm(p) * norm(q))) * 180) / Math.PI

describe('validateCell', () => {
  it('accepts every bundled crystal system example', () => {
    for (const s of CRYSTAL_SYSTEMS) expect(validateCell(s.cell)).toEqual({ valid: true })
  })

  it('rejects zero or negative lengths', () => {
    expect(validateCell({ a: 0, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 }).valid).toBe(false)
    expect(validateCell({ a: 1, b: -1, c: 1, alpha: 90, beta: 90, gamma: 90 }).valid).toBe(false)
  })

  it('rejects angles outside (0°, 180°)', () => {
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 0, beta: 90, gamma: 90 }).valid).toBe(false)
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 90, beta: 180, gamma: 90 }).valid).toBe(false)
  })

  it('rejects angle combinations that collapse to a plane', () => {
    // α = β + γ → c⃗ 落在 a⃗、b⃗ 平面內
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 120, beta: 60, gamma: 60 }).valid).toBe(false)
    // α + β + γ = 360°
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 120, beta: 120, gamma: 120 }).valid).toBe(false)
    // 三角不等式不成立
    expect(validateCell({ a: 1, b: 1, c: 1, alpha: 150, beta: 30, gamma: 30 }).valid).toBe(false)
  })
})

describe('cellToBasis', () => {
  it('reproduces lengths and angles for every example, including non-orthogonal cells', () => {
    for (const { cell } of CRYSTAL_SYSTEMS) {
      const { a, b, c } = cellToBasis(cell)
      expect(norm(a)).toBeCloseTo(cell.a, 10)
      expect(norm(b)).toBeCloseTo(cell.b, 10)
      expect(norm(c)).toBeCloseTo(cell.c, 10)
      expect(angleDeg(b, c)).toBeCloseTo(cell.alpha, 8)
      expect(angleDeg(a, c)).toBeCloseTo(cell.beta, 8)
      expect(angleDeg(a, b)).toBeCloseTo(cell.gamma, 8)
    }
  })

  it('gives a right-handed basis with volume matching cellVolume', () => {
    for (const { cell } of CRYSTAL_SYSTEMS) {
      const { a, b, c } = cellToBasis(cell)
      const cross: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
      expect(dot(cross, c)).toBeCloseTo(cellVolume(cell), 10)
      expect(dot(cross, c)).toBeGreaterThan(0)
    }
  })
})

describe('fractional ⇄ cartesian', () => {
  const samples: Vec3[] = [
    [0, 0, 0],
    [0.5, 0.5, 0.5],
    [0.25, 0.75, 0.1],
    [1, 1, 1],
    [-0.3, 2.2, 0.9],
  ]

  it('round-trips in every crystal system', () => {
    for (const { cell } of CRYSTAL_SYSTEMS) {
      const basis = cellToBasis(cell)
      for (const f of samples) {
        const back = cartToFrac(basis, fracToCart(basis, f))
        back.forEach((v, i) => expect(v).toBeCloseTo(f[i], 10))
      }
    }
  })

  it('maps unit fractional steps onto the lattice vectors in a triclinic cell', () => {
    const triclinic = CRYSTAL_SYSTEMS.find((s) => s.id === 'triclinic')!
    const basis = cellToBasis(triclinic.cell)
    expect(fracToCart(basis, [1, 0, 0])).toEqual(basis.a)
    expect(fracToCart(basis, [0, 1, 0])).toEqual(basis.b)
    expect(fracToCart(basis, [0, 0, 1])).toEqual(basis.c)
  })
})
