import type { Vec3 } from './types'

export interface PositionedAtom {
  element: string
  /** 直角座標。 */
  position: Vec3
}

export interface BondRuleLike {
  elements: [string, string]
  maxDistance: number
}

const MIN_DISTANCE = 1e-6

function distance(p: Vec3, q: Vec3): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

function matches(rule: BondRuleLike, x: string, y: string): boolean {
  const [a, b] = rule.elements
  return (a === x && b === y) || (a === y && b === x)
}

/**
 * 依明確規則找出鍵／最近鄰連線：元素組合符合且距離 ≤ maxDistance。
 * 只在已顯示的原子之間連線，不推測畫面外的鄰居。
 * 以格點分桶（cell size = 最大鍵長）只比較相鄰 27 格內的原子，避免 O(n²)；
 * 5×5×5 的 NaCl（約 1,000 顆）可在每次重建場景時即時完成。
 */
export function findBonds(atoms: readonly PositionedAtom[], rules: readonly BondRuleLike[]): [number, number][] {
  const bonds: [number, number][] = []
  if (!rules.length || atoms.length < 2) return bonds
  const cellSize = Math.max(...rules.map((r) => r.maxDistance))
  if (!(cellSize > 0)) return bonds

  const key = (c: Vec3) => `${c[0]},${c[1]},${c[2]}`
  const cellOf = (p: Vec3): Vec3 => [Math.floor(p[0] / cellSize), Math.floor(p[1] / cellSize), Math.floor(p[2] / cellSize)]
  const buckets = new Map<string, number[]>()
  atoms.forEach((atom, i) => {
    const k = key(cellOf(atom.position))
    buckets.set(k, [...(buckets.get(k) ?? []), i])
  })

  for (let i = 0; i < atoms.length; i++) {
    const [cx, cy, cz] = cellOf(atoms[i].position)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighbors = buckets.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!neighbors) continue
          for (const j of neighbors) {
            if (j <= i) continue
            const d = distance(atoms[i].position, atoms[j].position)
            if (d < MIN_DISTANCE) continue
            if (rules.some((r) => matches(r, atoms[i].element, atoms[j].element) && d <= r.maxDistance)) bonds.push([i, j])
          }
        }
      }
    }
  }
  // 與逐對比較的輸出順序一致，方便測試與除錯
  return bonds.sort((p, q) => p[0] - q[0] || p[1] - q[1])
}

/** 最近鄰距離（不同位置的原子對之最小距離）；呼叫端需提供足夠大的區塊以涵蓋週期鄰居。 */
export function nearestNeighborDistance(atoms: readonly PositionedAtom[]): number {
  let min = Infinity
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i].position, atoms[j].position)
      if (d > MIN_DISTANCE && d < min) min = d
    }
  }
  return min
}
