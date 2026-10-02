import { describe, expect, it } from 'vitest'
import { cellClipPlanes, cellToBasis, fracToCart, validateCell } from '../lattice'
import { findBonds, nearestNeighborDistance } from '../neighbors'
import { generateImages } from '../periodic'
import { MATERIALS } from '../../data/materials'
import { buildMotif, defaultParams, type StructureExample } from '../../data/types'
import { CRYSTAL_SYSTEMS } from '../../data/crystalSystems'
import type { Vec3 } from '../types'

const material = (id: string) => MATERIALS.find((m) => m.id === id)!

/** 以 n×n×n 區塊展開，回傳直角座標原子（含邊界複本）。 */
function expand(example: StructureExample, n: number, boundary = true) {
  const basis = cellToBasis(example.cell)
  const motif = buildMotif(example, defaultParams(example))
  const byId = new Map(motif.map((a) => [a.id, a]))
  return generateImages(motif, { repeatA: n, repeatB: n, repeatC: n, showBoundaryImages: boundary }, example.lattices[0].centering).map(
    (img) => ({ element: byId.get(img.baseId)!.element, position: fracToCart(basis, img.fractionalPosition), img }),
  )
}

const atomsPerCell = (id: string) => expand(material(id), 1, false).length

describe('material examples', () => {
  it('all have valid cells', () => {
    for (const m of MATERIALS) expect(validateCell(m.cell).valid).toBe(true)
  })

  it('give the textbook atom count per conventional cell', () => {
    expect(atomsPerCell('bcc-fe')).toBe(2)
    expect(atomsPerCell('fcc-cu')).toBe(4)
    expect(atomsPerCell('hcp-mg')).toBe(2)
    expect(atomsPerCell('alpha-u')).toBe(4)
    expect(atomsPerCell('cscl')).toBe(2)
    expect(atomsPerCell('nacl')).toBe(8)
    expect(atomsPerCell('diamond')).toBe(8)
    expect(atomsPerCell('zns')).toBe(8)
    expect(atomsPerCell('batio3')).toBe(5)
    expect(atomsPerCell('graphite')).toBe(4)
  })

  it('places α-U atoms at the slide coordinates including the (½,½,0) translations', () => {
    const y = 0.1025
    const pos = expand(material('alpha-u'), 1, false).map((a) => a.img.fractionalPosition.map((v) => +v.toFixed(4)))
    expect(pos).toEqual(
      expect.arrayContaining([
        [0, y, 0.25],
        [0, 1 - y, 0.75],
        [0.5, 0.5 + y, 0.25],
        [0.5, 0.5 - y, 0.75],
      ]),
    )
  })

  it('reproduces nearest-neighbour distances', () => {
    const nn = (id: string) => nearestNeighborDistance(expand(material(id), 2))
    expect(nn('bcc-fe')).toBeCloseTo((2.8665 * Math.sqrt(3)) / 2, 6)
    expect(nn('fcc-cu')).toBeCloseTo(3.6149 / Math.SQRT2, 6)
    expect(nn('diamond')).toBeCloseTo((3.567 * Math.sqrt(3)) / 4, 6)
    expect(nn('nacl')).toBeCloseTo(5.64 / 2, 6)
    // 石墨：投影片標示的 1.421 Å 為 C–C 鍵長
    expect(nn('graphite')).toBeCloseTo(1.421, 2)
  })

  it('links every interior diamond atom to exactly four neighbours', () => {
    const atoms = expand(material('diamond'), 2)
    const bonds = findBonds(atoms, material('diamond').bonds!)
    const degree = new Map<number, number>()
    for (const [i, j] of bonds) for (const k of [i, j]) degree.set(k, (degree.get(k) ?? 0) + 1)
    const interior = atoms.findIndex((a) => a.img.fractionalPosition.every((v, i) => Math.abs(v - [1.25, 1.25, 1.25][i]) < 1e-9))
    expect(degree.get(interior)).toBe(4)
  })

  it('does not bond graphite layers to each other (3.354 Å apart)', () => {
    const atoms = expand(material('graphite'), 2)
    for (const [i, j] of findBonds(atoms, material('graphite').bonds!)) {
      expect(Math.abs(atoms[i].position[2] - atoms[j].position[2])).toBeLessThan(1e-9)
    }
  })

  it('uses Cs–Cl only, never Cs–Cs or Cl–Cl, in CsCl', () => {
    const atoms = expand(material('cscl'), 1)
    const bonds = findBonds(atoms, material('cscl').bonds!)
    expect(bonds).toHaveLength(8)
    for (const [i, j] of bonds) expect(new Set([atoms[i].element, atoms[j].element])).toEqual(new Set(['Cs', 'Cl']))
  })
})

describe('cellClipPlanes', () => {
  const keeps = (planes: ReturnType<typeof cellClipPlanes>, p: Vec3) =>
    planes.every(({ normal, constant }) => normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2] + constant >= -1e-9)

  it('keeps exactly the fractional block [0,N] in a non-orthogonal cell', () => {
    const basis = cellToBasis(CRYSTAL_SYSTEMS.find((s) => s.id === 'triclinic')!.cell)
    const planes = cellClipPlanes(basis, [2, 1, 1])
    expect(keeps(planes, fracToCart(basis, [0.5, 0.5, 0.5]))).toBe(true)
    expect(keeps(planes, fracToCart(basis, [1.9, 0.99, 0.01]))).toBe(true)
    expect(keeps(planes, fracToCart(basis, [2.05, 0.5, 0.5]))).toBe(false)
    expect(keeps(planes, fracToCart(basis, [0.5, -0.05, 0.5]))).toBe(false)
    expect(keeps(planes, fracToCart(basis, [0.5, 0.5, 1.05]))).toBe(false)
  })
})

describe('findBonds spatial hashing', () => {
  it('matches brute-force pair search on a 4×4×4 NaCl block', () => {
    const atoms = expand(material('nacl'), 4)
    const rules = material('nacl').bonds!
    const brute: [number, number][] = []
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const [p, q] = [atoms[i].position, atoms[j].position]
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
        const [a, b] = [atoms[i].element, atoms[j].element]
        if (d > 1e-6 && d <= 2.9 && ((a === 'Na' && b === 'Cl') || (a === 'Cl' && b === 'Na'))) brute.push([i, j])
      }
    }
    expect(findBonds(atoms, rules)).toEqual(brute)
    expect(brute.length).toBeGreaterThan(100)
  })

  it('returns nothing without rules or with a single atom', () => {
    expect(findBonds([{ element: 'C', position: [0, 0, 0] }], material('diamond').bonds!)).toEqual([])
    expect(findBonds(expand(material('diamond'), 1), [])).toEqual([])
  })
})

describe('habit polyhedra', () => {
  it('builds closed shapes with the expected face and edge counts', async () => {
    const { cubeHabit, octahedronHabit, parallelepipedHabit, polyhedronExtent } = await import('../habit')
    const cube = cubeHabit(2)
    expect(cube.faces).toHaveLength(12)
    expect(cube.edges).toHaveLength(12)
    expect(polyhedronExtent(cube)).toBeCloseTo(2 * Math.sqrt(3), 10)
    const oct = octahedronHabit(2)
    expect(oct.faces).toHaveLength(8)
    expect(oct.edges).toHaveLength(12)
    const tri = parallelepipedHabit(cellToBasis(CRYSTAL_SYSTEMS.find((s) => s.id === 'triclinic')!.cell), 3)
    expect(tri.faces).toHaveLength(12)
    expect(tri.edges).toHaveLength(12)
  })
})
