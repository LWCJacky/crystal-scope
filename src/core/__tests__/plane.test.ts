import { describe, expect, it } from 'vitest'
import { cartToFrac, cellToBasis } from '../lattice'
import { formatMiller, fourIndexPlane, planeGeometry, planePolygon, reciprocalBasis, validateMiller } from '../plane'

const cubic2 = cellToBasis({ a: 2, b: 2, c: 2, alpha: 90, beta: 90, gamma: 90 })
const box = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] }

describe('晶面（規格 8.1 #10）', () => {
  it('(000) 被拒絕；非整數被拒絕', () => {
    expect(validateMiller(0, 0, 0).valid).toBe(false)
    expect(validateMiller(1.5, 0, 0).valid).toBe(false)
    expect(planePolygon(cubic2, 0, 0, 0, 1, 0, box)).toEqual([])
  })

  it('立方 a = 2：(100)、m = 1 為 x = 2 的平面，與 1×1×1 區塊的截面是 4 點', () => {
    const poly = planePolygon(cubic2, 1, 0, 0, 1, 0, box)
    expect(poly).toHaveLength(4)
    for (const p of poly) expect(p[0]).toBeCloseTo(2, 9)
  })

  it('(110) 法向沿對角、間距 2/√2；倒晶格無 2π', () => {
    const { unitNormal, spacing } = planeGeometry(cubic2, 1, 1, 0)
    expect(unitNormal[0]).toBeCloseTo(Math.SQRT1_2, 9)
    expect(unitNormal[1]).toBeCloseTo(Math.SQRT1_2, 9)
    expect(unitNormal[2]).toBeCloseTo(0, 9)
    expect(spacing).toBeCloseTo(2 / Math.SQRT2, 9)
    const r = reciprocalBasis(cubic2)
    expect(r.a[0]).toBeCloseTo(0.5, 9)
  })

  it('非正交晶胞：每個截點都滿足 h x + k y + l z = m；序號 m 與物理平移分開', () => {
    const basis = cellToBasis({ a: 3, b: 4, c: 5, alpha: 80, beta: 85, gamma: 95 })
    const poly = planePolygon(basis, 1, -1, 2, 1, 0, { min: [0, 0, 0], max: [2, 2, 2] })
    expect(poly.length).toBeGreaterThanOrEqual(3)
    for (const p of poly) {
      const [x, y, z] = cartToFrac(basis, p)
      expect(x - y + 2 * z).toBeCloseTo(1, 8)
    }
    const { unitNormal, spacing } = planeGeometry(basis, 1, -1, 2)
    const shifted = planePolygon(basis, 1, -1, 2, 1, 0.3, { min: [0, 0, 0], max: [2, 2, 2] })
    for (const p of shifted) {
      const [x, y, z] = cartToFrac(basis, p)
      // 沿法向平移 0.3 → 分率平面常數增加 0.3/d
      expect(x - y + 2 * z).toBeCloseTo(1 + 0.3 / spacing, 8)
    }
    expect(Math.hypot(...unitNormal)).toBeCloseTo(1, 12)
  })

  it('沒有交集回傳空陣列；多邊形依繞質心角度排序', () => {
    expect(planePolygon(cubic2, 1, 0, 0, 5, 0, box)).toEqual([])
    const poly = planePolygon(cubic2, 1, 1, 1, 1, 0, box)
    expect(poly).toHaveLength(3)
  })

  it('記法：負號上橫線；六方四指數 i = −(h + k)', () => {
    expect(formatMiller(1, -1, 0)).toBe('(11̄0)')
    expect(fourIndexPlane(1, 0, 0)).toEqual([1, 0, -1, 0])
  })
})
