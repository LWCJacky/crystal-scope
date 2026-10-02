import { describe, expect, it } from 'vitest'
import { buildLadderProfile, formatLength, ladderHeight, ladderState, scaleBar, visibleStages } from '../scaleLadder'

const A = 2.8665e-10 // α-Fe
const profile = buildLadderProfile(A)

describe('ladderHeight', () => {
  it('spans from 4 cm down to 1.4 cells, linear in log space', () => {
    expect(ladderHeight(profile, 0)).toBeCloseTo(0.04, 12)
    expect(ladderHeight(profile, 1)).toBeCloseTo(1.4 * A, 20)
    const mid = ladderHeight(profile, 0.5)
    expect(Math.log10(mid)).toBeCloseTo((Math.log10(0.04) + Math.log10(1.4 * A)) / 2, 10)
  })

  it('zooms at a constant rate per unit zoom (每段 zoom 放大相同倍率)', () => {
    const r1 = ladderHeight(profile, 0.1) / ladderHeight(profile, 0.2)
    const r2 = ladderHeight(profile, 0.7) / ladderHeight(profile, 0.8)
    expect(r1).toBeCloseTo(r2, 10)
  })
})

describe('ladderState', () => {
  it('shows only the macro object at the start and only cell+motif at the end', () => {
    expect(visibleStages(ladderState(profile, 0)).map((s) => s.id)).toEqual(['macro'])
    expect(visibleStages(ladderState(profile, 1)).map((s) => s.id)).toEqual(['motif'])
  })

  it('always has at least one fully visible stage (no blank frame)', () => {
    for (let z = 0; z <= 1; z += 0.01) {
      const s = ladderState(profile, z)
      expect(Math.max(...s.stages.map((x) => x.opacity))).toBeGreaterThan(0.45)
    }
  })

  it('keeps on-screen size continuous: lattice stages are in Å, so view height in units = metres / 1e-10', () => {
    const s = ladderState(profile, 0.8)
    const block = s.stages.find((x) => x.id === 'block')!
    const cell = s.stages.find((x) => x.id === 'cell')!
    expect(block.viewHeightUnits).toBeCloseTo(cell.viewHeightUnits, 10)
    expect(cell.viewHeightUnits).toBeCloseTo(s.heightMetres / 1e-10, 6)
  })

  it('freezes the macro camera below 10 µm instead of dollying into float precision limits', () => {
    const far = ladderState(profile, 0.3).stages[0]
    const near = ladderState(profile, 0.7).stages[0]
    expect(far.viewHeightUnits).toBeGreaterThan(near.viewHeightUnits)
    expect(near.viewHeightUnits).toBeCloseTo(1e-5 / 0.01, 12)
  })

  it('moves the camera target to the lattice point only in the motif phase', () => {
    expect(ladderState(profile, 0).targetBlend).toBe(0)
    expect(ladderState(profile, 1).targetBlend).toBe(1)
  })

  it('under reduced motion each stage holds a fixed view height while opacities still crossfade', () => {
    const a = ladderState(profile, 0.3, true)
    const b = ladderState(profile, 0.35, true)
    const macroA = a.stages.find((x) => x.id === 'macro')!
    const macroB = b.stages.find((x) => x.id === 'macro')!
    expect(macroA.viewHeightUnits).toBe(macroB.viewHeightUnits)
  })
})

describe('scale bar', () => {
  it('formats lengths with sensible units', () => {
    expect(formatLength(0.012)).toBe('1.2 cm')
    expect(formatLength(4.7e-5)).toBe('47.0 µm')
    expect(formatLength(2.4e-9)).toBe('2.4 nm')
    expect(formatLength(3.6e-10)).toBe('3.6 Å')
  })

  it('picks the largest 1/2/5 × 10ⁿ bar not exceeding 35% of the view', () => {
    expect(scaleBar(0.04).metres).toBeCloseTo(0.01, 12)
    expect(scaleBar(1e-6).metres).toBeCloseTo(2e-7, 18)
    expect(scaleBar(1e-6).fraction).toBeLessThanOrEqual(0.35)
  })
})
