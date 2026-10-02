// @ts-check
/**
 * 啟動層（石墨主題進度畫面）。
 *
 * 這個檔案在建置時由 vite.config.ts 內嵌進 index.html，必須先於主程式存在，
 * 因此不得 import 任何東西、不使用 TypeScript 語法。純邏輯（狀態機）以 export 提供給單元測試；
 * DOM 部分只在瀏覽器且頁面含 #boot 時執行。
 *
 * 協定（主程式呼叫）：window.__csBoot.report(stage, fraction) / ready() / fail(code, detail)
 * 完成時派發 document 事件 'cs:boot-done'。
 */

/** 各階段在整體進度中的區間。 */
export const STAGES = {
  script: [0, 0.6],
  init: [0.6, 0.7],
  webgl: [0.7, 0.85],
  frame: [0.85, 1],
}

export const TIMING = {
  /** 超過此時間仍未完成：顯示「連線較慢」提示。 */
  slowMs: 8000,
  /** 進度停止前進超過此時間：顯示「似乎停住了」與重試。 */
  stallMs: 15000,
  /** 整體逾時：轉為錯誤畫面。 */
  timeoutMs: 60000,
  /** 啟動層一旦顯示的最短停留時間，避免閃一下就消失。 */
  minShowMs: 400,
  /** 若在此時間內就緒，完全不顯示啟動層。 */
  skipIfReadyMs: 150,
  /** 自動重試的等待時間；用完後改為手動重試。 */
  retryDelays: [1000, 3000],
  /** 不定進度時爬行曲線的時間常數（秒）與上限。 */
  crawlTau: 6,
  crawlCap: 0.5,
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))

/**
 * 進度狀態機（無 DOM）。
 * @param {() => number} now 時間來源（毫秒），測試時可注入
 */
export function createMachine(now = () => Date.now()) {
  const s = {
    /** @type {'loading'|'slow'|'stalled'|'error'|'ready'} */
    status: 'loading',
    /** @type {keyof typeof STAGES} */
    stage: 'script',
    fraction: 0,
    determinate: true,
    bytes: { loaded: 0, total: /** @type {number|null} */ (null) },
    /** @type {{code: string, detail?: string}|null} */
    error: null,
    attempts: 0,
    startedAt: now(),
    lastProgressAt: now(),
  }

  function advance(f) {
    f = clamp01(f)
    if (f > s.fraction) {
      s.fraction = f
      s.lastProgressAt = now()
    }
  }

  return {
    state: s,
    /** 主程式下載進度；total 未知時進入不定進度模式。 */
    bytes(loaded, total) {
      s.stage = 'script'
      s.bytes = { loaded, total }
      if (total && total > 0) {
        s.determinate = true
        advance(STAGES.script[1] * (loaded / total))
      } else {
        s.determinate = false
        // 有資料流入也算「有進展」，避免被判為停滯
        s.lastProgressAt = now()
      }
    },
    /** 主程式回報階段進度（0–1）。 */
    report(stage, fraction = 1) {
      const band = STAGES[stage]
      if (!band) return
      s.stage = stage
      s.determinate = true
      advance(band[0] + (band[1] - band[0]) * clamp01(fraction))
    },
    ready() {
      s.status = 'ready'
      s.fraction = 1
      s.stage = 'frame'
    },
    fail(code, detail) {
      s.status = 'error'
      s.error = { code, detail }
    },
    /** 每隔一段時間呼叫：更新不定進度與慢速／停滯／逾時狀態。 */
    tick() {
      if (s.status === 'ready' || s.status === 'error') return s.status
      const t = now()
      if (!s.determinate && s.stage === 'script') {
        const elapsed = (t - s.startedAt) / 1000
        s.fraction = Math.max(s.fraction, TIMING.crawlCap * (1 - Math.exp(-elapsed / TIMING.crawlTau)))
      }
      if (t - s.startedAt > TIMING.timeoutMs) {
        s.status = 'error'
        s.error = { code: 'timeout' }
      } else if (t - s.lastProgressAt > TIMING.stallMs) s.status = 'stalled'
      else if (t - s.startedAt > TIMING.slowMs) s.status = 'slow'
      else s.status = 'loading'
      return s.status
    },
    /** 重試：回傳自動重試的延遲（毫秒），用完自動次數後回傳 null（需手動）。 */
    retryDelay() {
      const d = TIMING.retryDelays[s.attempts]
      s.attempts++
      return d === undefined ? null : d
    },
    /** 重新開始（保留重試次數）。 */
    restart() {
      s.status = 'loading'
      s.stage = 'script'
      s.fraction = 0
      s.determinate = true
      s.bytes = { loaded: 0, total: null }
      s.error = null
      s.startedAt = now()
      s.lastProgressAt = now()
    },
  }
}

/**
 * 石墨蜂巢的六角環：回傳每個六角形的中心（軸座標 → 平面座標）與所屬環數。
 * @param {number} rings 環數（0 = 中心一個六角形）
 * @param {number} size 六角形中心到頂點的距離
 */
export function honeycomb(rings, size) {
  const cells = []
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r))
      // 尖角朝上的六角形：相鄰中心距離 √3·size
      const x = Math.sqrt(3) * size * (q + r / 2)
      const y = 1.5 * size * r
      cells.push({ q, r, ring, x, y })
    }
  }
  return cells.sort((a, b) => a.ring - b.ring)
}

/** 六角形頂點（尖角朝上）。 */
export function hexagonPoints(cx, cy, size) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30)
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)])
  }
  return pts
}

/** 依進度應顯示的六角形數量（A、B 兩層依序長出）。 */
export function revealCount(fraction, total) {
  return Math.round(clamp01(fraction) * total)
}

/** 從 cookie 讀介面語言；讀不到依瀏覽器語言。 */
export function detectLocale(cookie, languages) {
  try {
    const m = /(?:^|;\s*)crystalscope_settings=([^;]+)/.exec(cookie || '')
    if (m) {
      const parsed = JSON.parse(decodeURIComponent(m[1]))
      const loc = parsed && parsed.s && parsed.s.locale
      if (loc === 'zh-TW' || loc === 'en' || loc === 'ja') return loc
    }
  } catch {
    /* 忽略損壞的 cookie */
  }
  for (const raw of languages || []) {
    const l = String(raw).toLowerCase()
    if (l.startsWith('zh')) return 'zh-TW'
    if (l.startsWith('ja')) return 'ja'
    if (l.startsWith('en')) return 'en'
  }
  return 'en'
}

/** 啟動層文案（三語內嵌；主程式的 i18n 此時尚未載入）。 */
export const MESSAGES = {
  'zh-TW': {
    title: '晶體結構觀察室',
    stages: { script: '下載主程式', init: '初始化', webgl: '建立 3D 顯示', frame: '繪製第一幀' },
    loading: '載入中',
    slow: '連線較慢，仍在載入（已收到 {kb} KB）',
    stalled: '似乎停住了，仍在等待…',
    retry: '重試',
    reload: '重新整理',
    retrying: '{s} 秒後自動重試',
    issues: '回報問題',
    errors: {
      webgl: '你的瀏覽器無法建立 3D 顯示（WebGL 2）。請更新瀏覽器、在設定中開啟硬體加速，或改用 Chrome、Edge、Firefox 或 Safari 16 以上。',
      offline: '目前離線。恢復連線後會自動重試。',
      fetch: '主程式下載失敗。',
      timeout: '載入逾時（超過 60 秒）。',
      runtime: '啟動時發生錯誤。',
    },
  },
  en: {
    title: 'Crystal Structure Observatory',
    stages: { script: 'Downloading app', init: 'Initialising', webgl: 'Creating 3D view', frame: 'Rendering first frame' },
    loading: 'Loading',
    slow: 'Slow connection, still loading ({kb} KB received)',
    stalled: 'This seems stuck; still waiting…',
    retry: 'Retry',
    reload: 'Reload',
    retrying: 'Retrying in {s} s',
    issues: 'Report a problem',
    errors: {
      webgl: 'Your browser cannot create a 3D view (WebGL 2). Update the browser, enable hardware acceleration, or use Chrome, Edge, Firefox or Safari 16+.',
      offline: 'You are offline. Loading resumes automatically when the connection returns.',
      fetch: 'The app failed to download.',
      timeout: 'Loading timed out (over 60 s).',
      runtime: 'An error occurred while starting.',
    },
  },
  ja: {
    title: '結晶構造観察室',
    stages: { script: 'アプリをダウンロード中', init: '初期化中', webgl: '3D 表示を作成中', frame: '最初のフレームを描画中' },
    loading: '読み込み中',
    slow: '接続が遅いため読み込み中です（{kb} KB 受信）',
    stalled: '止まっているようです。待機中…',
    retry: '再試行',
    reload: '再読み込み',
    retrying: '{s} 秒後に自動で再試行',
    issues: '問題を報告',
    errors: {
      webgl: 'このブラウザでは 3D 表示（WebGL 2）を作成できません。ブラウザを更新するか、ハードウェアアクセラレーションを有効にするか、Chrome・Edge・Firefox・Safari 16 以降をお使いください。',
      offline: 'オフラインです。接続が回復すると自動的に再開します。',
      fetch: 'アプリのダウンロードに失敗しました。',
      timeout: '読み込みがタイムアウトしました（60 秒超）。',
      runtime: '起動時にエラーが発生しました。',
    },
  },
}

const ISSUES_URL = 'https://github.com/LWCJacky/crystal-scope/issues'
const RINGS = 3
const HEX = 13
/** 俯視壓扁比例（營造兩層堆疊的立體感）與 B 層抬升高度 */
const SQUASH = 0.62
const LIFT = 22

/** 建立兩層石墨的 SVG；回傳可依進度顯示的六角形元素清單（A 層在前、B 層在後）。 */
function buildGraphite(svg) {
  const ns = 'http://www.w3.org/2000/svg'
  const cells = honeycomb(RINGS, HEX)
  const layers = [
    { id: 'A', dx: 0, dy: 0, lift: LIFT / 2, cls: 'la' },
    // AB 堆疊：B 層六角形的中心正對 A 層的原子（頂點），即平面內錯開一個「中心到頂點」的距離
    { id: 'B', dx: 0, dy: -HEX, lift: -LIFT / 2, cls: 'lb' },
  ]
  const shapes = []
  for (const layer of layers) {
    const g = document.createElementNS(ns, 'g')
    g.setAttribute('class', layer.cls)
    g.setAttribute('transform', `translate(0 ${layer.lift}) scale(1 ${SQUASH})`)
    for (const c of cells) {
      const pts = hexagonPoints(c.x + layer.dx, c.y + layer.dy, HEX)
      const poly = document.createElementNS(ns, 'polygon')
      poly.setAttribute('points', pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '))
      g.appendChild(poly)
      for (const [x, y] of pts) {
        const dot = document.createElementNS(ns, 'circle')
        dot.setAttribute('cx', x.toFixed(1))
        dot.setAttribute('cy', y.toFixed(1))
        dot.setAttribute('r', '1.7')
        g.appendChild(dot)
      }
      shapes.push(g.children.length ? Array.from(g.children).slice(-7) : [])
    }
    svg.appendChild(g)
  }
  // 兩層交錯顯示（A 環 0、B 環 0、A 環 1…），AB 堆疊從一開始就看得到
  const half = shapes.length / 2
  const interleaved = []
  for (let i = 0; i < half; i++) interleaved.push(shapes[i], shapes[half + i])
  return interleaved
}

/** DOM 控制：建立畫面、驅動狀態機、下載並啟動主程式。 */
export function mount(doc, win) {
  const root = doc.getElementById('boot')
  if (!root) return null
  const locale = detectLocale(doc.cookie, win.navigator.languages || [win.navigator.language])
  const T = MESSAGES[locale]
  const $ = (sel) => root.querySelector(sel)
  const bar = $('.boot-bar')
  const pct = $('.boot-pct')
  const stageEl = $('.boot-stage')
  const hint = $('.boot-hint')
  const errBox = $('.boot-error')
  const errText = $('.boot-error-text')
  const retryBtn = $('.boot-retry')
  const reloadBtn = $('.boot-reload')
  const issues = $('.boot-issues')
  const svg = $('svg')
  root.setAttribute('lang', locale === 'zh-TW' ? 'zh-Hant' : locale)
  $('.boot-sub').textContent = T.title
  retryBtn.textContent = T.retry
  reloadBtn.textContent = T.reload
  issues.textContent = T.issues
  issues.href = ISSUES_URL

  const shapes = buildGraphite(svg)
  const machine = createMachine()
  const mainTag = doc.querySelector('script[data-main]')
  const mainSrc = mainTag ? mainTag.getAttribute('data-main') : null
  /** 建置時注入的未壓縮大小；串流讀到的位元組是解壓後的，兩者才能相比 */
  const mainSize = mainTag ? Number(mainTag.getAttribute('data-size')) || 0 : 0
  let shown = false
  let done = false
  let shownAt = 0
  let retryTimer = 0
  let controller = null

  function render() {
    const s = machine.state
    const f = s.fraction
    bar.style.transform = `scaleX(${f.toFixed(4)})`
    pct.textContent = s.determinate ? `${Math.round(f * 100)}%` : T.loading + '…'
    stageEl.textContent = T.stages[s.stage]
    // 一開始至少顯示中心六角形；錯誤時顯示完整（灰色）結構，不要留白
    const n = s.status === 'error' ? shapes.length : Math.max(1, revealCount(f, shapes.length))
    shapes.forEach((els, i) => els.forEach((el) => el.classList.toggle('on', i < n)))
    root.classList.toggle('indeterminate', !s.determinate)
    root.classList.toggle('error', s.status === 'error')
    if (s.status === 'error' && s.error) {
      errText.textContent = T.errors[s.error.code] || T.errors.runtime
      if (s.error.detail) errText.textContent += ` (${s.error.detail})`
      errBox.hidden = false
      hint.textContent = ''
    } else {
      errBox.hidden = true
      const kb = Math.round(s.bytes.loaded / 1024)
      hint.textContent = s.status === 'stalled' ? T.stalled : s.status === 'slow' ? T.slow.replace('{kb}', String(kb)) : ''
    }
  }

  function show() {
    if (shown || done) return
    shown = true
    shownAt = Date.now()
    root.classList.add('show')
  }
  // CSS 會在 150 ms 後自行顯示；若腳本較晚才執行且元素已可見，視為已顯示
  if (win.getComputedStyle(root).opacity !== '0') show()

  function finish() {
    if (done) return
    done = true
    win.clearInterval(ticker)
    const leave = () => {
      root.classList.add('out')
      const app = doc.getElementById('app')
      if (app) app.removeAttribute('aria-busy')
      win.setTimeout(() => {
        root.remove()
        doc.dispatchEvent(new win.Event('cs:boot-done'))
      }, 240)
    }
    if (!shown) {
      root.remove()
      const app = doc.getElementById('app')
      if (app) app.removeAttribute('aria-busy')
      doc.dispatchEvent(new win.Event('cs:boot-done'))
      return
    }
    const wait = Math.max(0, TIMING.minShowMs - (Date.now() - shownAt))
    win.setTimeout(leave, wait)
  }

  function fail(code, detail) {
    machine.fail(code, detail)
    show()
    render()
    if (code === 'fetch' || code === 'timeout') scheduleRetry()
  }

  function scheduleRetry() {
    const delay = machine.retryDelay()
    if (delay === null) return
    let left = Math.round(delay / 1000)
    hint.textContent = T.retrying.replace('{s}', String(left))
    retryTimer = win.setInterval(() => {
      left--
      if (left <= 0) {
        win.clearInterval(retryTimer)
        restart()
      } else hint.textContent = T.retrying.replace('{s}', String(left))
    }, 1000)
  }

  function restart() {
    win.clearInterval(retryTimer)
    if (controller) controller.abort()
    machine.restart()
    render()
    start()
  }

  async function download() {
    if (!mainSrc) return true // 開發模式：由瀏覽器自行載入，只等主程式回報
    controller = new win.AbortController()
    const res = await win.fetch(mainSrc, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // 有壓縮時 Content-Length 是壓縮後大小，不能當分母；優先用建置時注入的未壓縮大小
    const encoded = !!res.headers.get('content-encoding')
    const total = mainSize || (!encoded ? Number(res.headers.get('content-length')) || null : null)
    const reader = res.body && res.body.getReader ? res.body.getReader() : null
    if (!reader) {
      await res.arrayBuffer()
      machine.bytes(total || 0, total)
      return true
    }
    let loaded = 0
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      loaded += value.length
      machine.bytes(loaded, total)
      render()
    }
    machine.bytes(total || loaded, total || loaded)
    return true
  }

  /** 等主樣式表載入（建置時以 media=print 非阻擋載入）；逾時 20 s 則不再等，避免卡死。 */
  function cssReady() {
    const link = doc.querySelector('link[data-main-css]')
    if (!link || link.dataset.loaded || link.media === 'all') return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => resolve()
      link.addEventListener('load', done, { once: true })
      link.addEventListener('error', done, { once: true })
      win.setTimeout(done, 20000)
    })
  }

  async function start() {
    // 先檢查不可能成功的情況，再花流量下載
    const probe = doc.createElement('canvas')
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return fail('webgl')
    if (win.navigator.onLine === false) {
      fail('offline')
      win.addEventListener('online', restart, { once: true })
      return
    }
    try {
      await download()
      render()
      await cssReady()
      if (mainSrc) await import(/* @vite-ignore */ mainSrc)
    } catch (e) {
      if (e && e.name === 'AbortError') return
      if (win.navigator.onLine === false) {
        fail('offline')
        win.addEventListener('online', restart, { once: true })
      } else fail('fetch', e && e.message ? e.message : undefined)
    }
  }

  const ticker = win.setInterval(() => {
    const status = machine.tick()
    render()
    if (status === 'error' && machine.state.error && machine.state.error.code === 'timeout') {
      win.clearInterval(ticker)
      fail('timeout')
    }
  }, 250)

  // 150 ms 內就緒就不顯示（快取命中時避免閃一下）
  win.setTimeout(show, TIMING.skipIfReadyMs)

  retryBtn.addEventListener('click', restart)
  reloadBtn.addEventListener('click', () => win.location.reload())
  // 主程式就緒前的未捕捉錯誤
  const onError = (e) => {
    if (done) return
    const msg = (e && (e.reason && e.reason.message)) || (e && e.message) || ''
    fail('runtime', msg ? String(msg).slice(0, 120) : undefined)
  }
  win.addEventListener('error', onError)
  win.addEventListener('unhandledrejection', onError)

  const api = {
    report(stage, fraction) {
      machine.report(stage, fraction)
      render()
    },
    ready() {
      win.removeEventListener('error', onError)
      win.removeEventListener('unhandledrejection', onError)
      machine.ready()
      render()
      finish()
    },
    fail,
    locale,
  }
  win.__csBoot = api
  render()
  start()
  return api
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('boot')) {
  mount(document, window)
}
