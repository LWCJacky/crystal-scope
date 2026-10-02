import { describe, expect, it } from 'vitest'
import { directionVector, formatIndices, reduceIndices, validateIndices } from '../direction'
import { applyConstraints, lockedKeys } from '../constraints'
import { cellToBasis } from '../lattice'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'

describe('validateIndices', () => {
  it('rejects [000]', () => {
    expect(validateIndices(0, 0, 0).valid).toBe(false)
  })

  it('accepts positive, negative and zero components', () => {
    expect(validateIndices(1, -1, 0).valid).toBe(true)
  })

  it('rejects non-integers in the three-index form', () => {
    expect(validateIndices(0.5, 0, 1).valid).toBe(false)
  })
})

describe('directionVector', () => {
  it('equals u·a + v·b + w·c in a non-orthogonal cell', () => {
    const basis = cellToBasis(CRYSTAL_SYSTEMS.find((s) => s.id === 'triclinic')!.cell)
    const d = directionVector(basis, 1, -2, 3)
    for (let i = 0; i < 3; i++) {
      expect(d[i]).toBeCloseTo(basis.a[i] - 2 * basis.b[i] + 3 * basis.c[i], 12)
    }
  })

  it('[110] in the hexagonal cell is not along the cartesian diagonal', () => {
    const basis = cellToBasis(CRYSTAL_SYSTEMS.find((s) => s.id === 'hexagonal')!.cell)
    const [x, y] = directionVector(basis, 1, 1, 0)
    expect((Math.atan2(y, x) * 180) / Math.PI).toBeCloseTo(60, 10)
  })
})

describe('reduceIndices / formatIndices', () => {
  it('reduces to lowest integer ratio', () => {
    expect(reduceIndices(2, 2, 0)).toEqual([1, 1, 0])
    expect(reduceIndices(-4, 2, 6)).toEqual([-2, 1, 3])
  })

  it('writes negatives with an overbar', () => {
    expect(formatIndices(1, -1, 0)).toBe('[11̄0]')
  })
})

describe('constraints', () => {
  it('leaves every bundled example unchanged (examples satisfy their own setting)', () => {
    for (const s of CRYSTAL_SYSTEMS) expect(applyConstraints(s.systemId, s.cell)).toEqual(s.cell)
  })

  it('locks cubic b, c and all angles to follow a', () => {
    const cell = applyConstraints('cubic', { a: 2, b: 3, c: 4, alpha: 80, beta: 70, gamma: 60 })
    expect(cell).toEqual({ a: 2, b: 2, c: 2, alpha: 90, beta: 90, gamma: 90 })
    expect(lockedKeys('triclinic')).toEqual([])
  })
})
