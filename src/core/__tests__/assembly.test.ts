import { describe, expect, it } from 'vitest'
import {
  assemblyDuration,
  pieceOutline,
  piecePose,
  pieceSolid,
} from '../assembly'
import { easeInOut, easeOut } from '../easing'


describe('easing', () => {
  it('starts at 0, ends at 1 and is monotonic', () => {
    for (const f of [easeOut, easeInOut]) {
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
      let prev = 0
      for (let x = 0.05; x < 1; x += 0.05) {
        expect(f(x)).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = f(x)
      }
    }
  })

  it('ease-out is front-loaded', () => {
    expect(easeOut(0.2)).toBeGreaterThan(0.5)
  })
})

describe('piece outlines', () => {
  it('draws triangular wedges and rhombic cells', () => {
    expect(pieceOutline(0, 'wedge6', 1)).toHaveLength(9)
    expect(pieceOutline(0, 'cell3', 1)).toHaveLength(12)
  })
})

describe('piecePose', () => {
  it('ends with every piece in its final place', () => {
    for (const mode of ['wedge6', 'cell3'] as const) {
      const end = assemblyDuration(mode)
      for (let k = 0; k < (mode === 'wedge6' ? 6 : 3); k++) {
        expect(piecePose(k, mode, end)).toEqual({ angle: 0, radial: 0, opacity: 1 })
      }
    }
  })

  it('starts each piece hidden at the first piece’s bearing', () => {
    const p = piecePose(3, 'wedge6', 3 * 0.9)
    expect(p.opacity).toBe(0)
    expect(p.angle).toBeCloseTo(-Math.PI, 10)
    expect(p.radial).toBe(1)
  })

  it('does not move under reduced motion', () => {
    for (let t = 0; t < 6; t += 0.3) {
      const p = piecePose(2, 'wedge6', t, true)
      expect(p.angle).toBe(0)
      expect(p.radial).toBe(0)
    }
  })
})

describe('piece solids', () => {
  it('builds closed piece solids', () => {
    expect(pieceSolid(0, 'wedge6', 1).faces).toHaveLength(2 + 6)
    expect(pieceSolid(0, 'cell3', 1).faces).toHaveLength(4 + 8)
  })
})
