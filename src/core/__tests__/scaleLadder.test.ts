import { describe, expect, it } from 'vitest'
import { buildLadderProfile, formatLength, ladderHeight, ladderSeconds, ladderState, scaleBar, visibleStages, zoomAtTime } from '../scaleLadder'

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

  it('freezes the polycrystal rod camera below 10 µm; the single-crystal habit never freezes', () => {
    const far = ladderState(profile, 0.3).stages[0]
    const near = ladderState(profile, 0.7).stages[0]
    expect(far.viewHeightUnits).toBeGreaterThan(near.viewHeightUnits)
    expect(near.viewHeightUnits).toBeCloseTo(1e-5 / 0.01, 12)
    const single = buildLadderProfile(A, 0.01, false)
    expect(ladderState(single, 0.5).stages[0].viewHeightUnits).toBeLessThan(1e-5 / 0.01)
  })

  it('hands the single crystal from habit to surface lattice around 1 mm, seamlessly (both ≈ opaque at 1 mm)', () => {
    const single = buildLadderProfile(A, 0.01, false)
    const zAt = (h: number) => (Math.log10(h) - Math.log10(single.startHeight)) / (Math.log10(single.endHeight) - Math.log10(single.startHeight))
    let overlapped = false
    for (let h = 1.5e-3; h >= 4e-4; h *= 0.95) {
      const s = Object.fromEntries(ladderState(single, zAt(h)).stages.map((x) => [x.id, x.opacity]))
      // 交接全程至少一級接近不透明（實心面同色，看不到接縫）
      expect(Math.max(s.macro, s.field)).toBeGreaterThan(0.9)
      if (s.macro > 0.3 && s.field > 0.3) overlapped = true
    }
    expect(overlapped).toBe(true)
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

describe('time warp', () => {
  it('runs 17.5 s for polycrystals and 13.5 s for single crystals, ending at zoom 1', () => {
    const poly = buildLadderProfile(A, 0.01, true)
    const single = buildLadderProfile(A, 0.01, false)
    expect(ladderSeconds(poly)).toBe(17.5)
    expect(ladderSeconds(single)).toBe(13.5)
    expect(zoomAtTime(poly, 0)).toBe(0)
    expect(zoomAtTime(poly, 18)).toBe(1)
    expect(zoomAtTime(single, 14)).toBe(1)
  })

  it('is monotonic and spends more time per decade on the lattice than inside a grain', () => {
    const poly = buildLadderProfile(A, 0.01, true)
    let prev = 0
    for (let t = 0; t <= 17.5; t += 0.1) {
      const z = zoomAtTime(poly, t)
      expect(z).toBeGreaterThanOrEqual(prev)
      prev = z
    }
    // 晶粒內部段（7 s → 9.5 s）每秒放大的倍率，應大於晶格段（9.5 s → 17.5 s）
    const rate = (t0: number, t1: number) => (zoomAtTime(poly, t1) - zoomAtTime(poly, t0)) / (t1 - t0)
    expect(rate(7, 9.5)).toBeGreaterThan(rate(9.5, 17.5) * 2)
  })

  it('shows the GPU surface lattice alone across the µm→nm range before the solid block', () => {
    const ids = (z: number) => visibleStages(ladderState(profile, z)).map((s) => s.id)
    const fieldOnly = [...Array(100).keys()].map((i) => i / 100).find((z) => ids(z).join() === 'field')
    expect(fieldOnly).toBeDefined()
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

describe('block → cell handoff', () => {
  it('has the cell fully visible before the block starts fading, and the block gone before the camera enters it', () => {
    const a = A
    const at = (h: number) => {
      // 反解 zoom：h = 10^(lerp(log start, log end, z))
      const z = (Math.log10(h) - Math.log10(profile.startHeight)) / (Math.log10(profile.endHeight) - Math.log10(profile.startHeight))
      const s = ladderState(profile, z)
      return Object.fromEntries(s.stages.map((x) => [x.id, x.opacity]))
    }
    expect(at(10.01 * a).cell).toBeCloseTo(1, 2)
    expect(at(10.01 * a).block).toBeCloseTo(1, 2)
    // 視線接近體對角線：相機在視野 6.8a 時進入 11³ 區塊的角落（1.37 × 6.8a ≈ 9.3a）
    expect(at(7 * a).block).toBeLessThan(0.01)
  })
})
