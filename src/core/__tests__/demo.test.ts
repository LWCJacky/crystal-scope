import { describe, expect, it } from 'vitest'
import { assemblyDuration } from '../assembly'
import { demoDuration, demoState } from '../demo'

const counts = { atomLayers: 3, latticeLayers: 2 }

describe('assembly demo: merge first, then reveal the full structure', () => {
  it('keeps every atom layer hidden until the merge is finished', () => {
    const s = demoState('assembly', 'wedge6', assemblyDuration('wedge6'), counts)
    expect(s.atomLayers).toEqual([0, 0, 0])
    expect(s.faces).toBe(1)
    expect(s.bonds).toBe(0)
  })

  it('reveals layers bottom-up and shows bonds last', () => {
    const s = demoState('assembly', 'wedge6', assemblyDuration('wedge6') + 0.6, counts)
    expect(s.atomLayers[0]).toBeGreaterThan(s.atomLayers[2])
    expect(s.bonds).toBe(0)
  })

  it('ends with the complete structure and no piece faces', () => {
    const s = demoState('assembly', 'cell3', demoDuration('assembly', 'cell3'), counts)
    expect(s.atomLayers).toEqual([1, 1, 1])
    expect(s.faces).toBe(0)
    expect(s.bonds).toBe(1)
  })
})

describe('build demo: edges → lattice points → motif atoms → bonds', () => {
  it('starts empty', () => {
    const s = demoState('build', 'wedge6', 0, counts)
    expect(s.edges).toBe(0)
    expect(s.latticeLayers).toEqual([0, 0])
    expect(s.atomLayers).toEqual([0, 0, 0])
  })

  it('shows lattice points before any atom', () => {
    const s = demoState('build', 'wedge6', 1.35, counts)
    expect(s.latticeLayers.every((o) => o > 0.9)).toBe(true)
    expect(s.atomLayers.every((o) => o === 0)).toBe(true)
  })

  it('ends with atoms and bonds, lattice points faded out', () => {
    const s = demoState('build', 'wedge6', demoDuration('build', 'wedge6'), counts)
    expect(s.atomLayers).toEqual([1, 1, 1])
    expect(s.latticeLayers).toEqual([0, 0])
    expect(s.bonds).toBe(1)
  })

  it('keeps lattice points when there are no atoms (lattice-point view)', () => {
    const s = demoState('build', 'wedge6', demoDuration('build', 'wedge6'), { atomLayers: 0, latticeLayers: 2 })
    expect(s.latticeLayers).toEqual([1, 1])
  })
})
