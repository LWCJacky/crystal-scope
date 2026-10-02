import { describe, expect, it } from 'vitest'
import { createMachine, detectLocale, honeycomb, MESSAGES, revealCount, STAGES, TIMING } from '../boot.js'
import { MESSAGES as APP_MESSAGES } from '../../i18n'
import { LOCALE_IDS } from '../../i18n/types'

function clock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('boot progress machine', () => {
  it('maps bytes and stage reports onto one monotonic 0–1 progress', () => {
    const c = clock()
    const m = createMachine(c.now)
    m.bytes(400, 800)
    expect(m.state.fraction).toBeCloseTo(0.3, 6)
    m.bytes(800, 800)
    expect(m.state.fraction).toBeCloseTo(STAGES.script[1], 6)
    m.report('init')
    m.report('webgl', 0.5)
    expect(m.state.fraction).toBeCloseTo(0.775, 6)
    // 進度不會倒退
    m.report('init')
    expect(m.state.fraction).toBeCloseTo(0.775, 6)
    m.ready()
    expect(m.state.status).toBe('ready')
    expect(m.state.fraction).toBe(1)
  })

  it('crawls towards a cap when the total size is unknown and never claims completion', () => {
    const c = clock()
    const m = createMachine(c.now)
    m.bytes(1000, null)
    expect(m.state.determinate).toBe(false)
    c.advance(3000)
    m.tick()
    const early = m.state.fraction
    c.advance(60000 - 3000 - 1)
    m.tick()
    expect(m.state.fraction).toBeGreaterThan(early)
    expect(m.state.fraction).toBeLessThanOrEqual(TIMING.crawlCap)
  })

  it('reports slow, then stalled, then timeout as time passes without progress', () => {
    const c = clock()
    const m = createMachine(c.now)
    m.bytes(100, 1000)
    expect(m.tick()).toBe('loading')
    c.advance(TIMING.slowMs + 1)
    expect(m.tick()).toBe('slow')
    c.advance(TIMING.stallMs)
    expect(m.tick()).toBe('stalled')
    // 有新進度就回到正常
    m.bytes(500, 1000)
    expect(m.tick()).toBe('slow')
    c.advance(TIMING.timeoutMs)
    expect(m.tick()).toBe('error')
    expect(m.state.error?.code).toBe('timeout')
  })

  it('retries automatically twice with backoff, then requires a manual retry', () => {
    const m = createMachine()
    expect(m.retryDelay()).toBe(1000)
    expect(m.retryDelay()).toBe(3000)
    expect(m.retryDelay()).toBeNull()
    m.fail('fetch', 'HTTP 503')
    expect(m.state.status).toBe('error')
    m.restart()
    expect(m.state.status).toBe('loading')
    expect(m.state.fraction).toBe(0)
    expect(m.state.attempts).toBe(3)
  })
})

describe('graphite geometry', () => {
  it('builds 1 + 3n(n+1) hexagons for n rings, sorted from the centre outwards', () => {
    const cells = honeycomb(3, 10)
    expect(cells).toHaveLength(37)
    expect(cells[0].ring).toBe(0)
    expect(cells[cells.length - 1].ring).toBe(3)
    for (let i = 1; i < cells.length; i++) expect(cells[i].ring).toBeGreaterThanOrEqual(cells[i - 1].ring)
  })

  it('reveals shapes in proportion to progress', () => {
    expect(revealCount(0, 74)).toBe(0)
    expect(revealCount(0.5, 74)).toBe(37)
    expect(revealCount(1, 74)).toBe(74)
  })
})

describe('boot locale and messages', () => {
  it('reads the locale from the settings cookie, falling back to the browser language', () => {
    const cookie = `crystalscope_settings=${encodeURIComponent(JSON.stringify({ v: 1, s: { locale: 'ja' } }))}`
    expect(detectLocale(cookie, ['en'])).toBe('ja')
    expect(detectLocale('', ['zh-TW'])).toBe('zh-TW')
    expect(detectLocale('crystalscope_settings=%7Bbroken', ['de'])).toBe('en')
  })

  it('has every locale, stage and error code, consistent with the app locales', () => {
    for (const id of LOCALE_IDS) {
      const m = MESSAGES[id]
      expect(m).toBeDefined()
      for (const stage of Object.keys(STAGES)) expect(m.stages[stage as keyof typeof STAGES]).toBeTruthy()
      for (const code of ['webgl', 'offline', 'fetch', 'timeout', 'runtime']) expect(m.errors[code]).toBeTruthy()
      // 標題與主程式的副標一致
      expect(m.title).toBe(APP_MESSAGES[id]['app.subtitle'])
    }
  })
})
