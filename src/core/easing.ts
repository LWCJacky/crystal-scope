/** 三次貝茲緩動曲線求值（x → y），以牛頓法求參數 t，失敗時改用二分法。 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  // 收斂浮點誤差，確保終點精確為 1（例如 1.0000000000000002 → 1）
  const snap = (y: number) => (Math.abs(y - 1) < 1e-9 ? 1 : Math.abs(y) < 1e-9 ? 0 : y)
  const sampleY = (t: number) => snap(((ay * t + by) * t + cy) * t)
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-6) return sampleY(t)
      const d = slopeX(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    while (hi - lo > 1e-6) {
      if (sampleX(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sampleY(t)
  }
}

/** 進場：強 ease-out。 */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1)
/** 畫面上的移動：強 ease-in-out。 */
export const easeInOut = cubicBezier(0.77, 0, 0.175, 1)
