import { describe, expect, it } from 'vitest'
import { COOKIE_NAME, decodeSettings, encodeSettings, loadSettings, saveSettings, type CookieJar } from '../cookieStorage'
import { defaultSettings, diffFromDefaults, sanitizeSettings } from '../settings'

/** 模擬瀏覽器 cookie：寫入時解析 name=value 與 max-age=0 刪除。 */
function fakeJar(): CookieJar & { store: Map<string, string>; last: string } {
  const store = new Map<string, string>()
  return {
    store,
    last: '',
    read: () => [...store].map(([k, v]) => `${k}=${v}`).join('; '),
    write(cookie) {
      this.last = cookie
      const [pair, ...attrs] = cookie.split('; ')
      const [k, ...v] = pair.split('=')
      if (attrs.includes('max-age=0')) store.delete(k)
      else store.set(k, v.join('='))
    },
  }
}

const opts = { path: '/crystal-scope/', secure: true }

describe('sanitizeSettings', () => {
  it('falls back to defaults for missing, invalid or unknown fields', () => {
    const s = sanitizeSettings({ autoplay: 'yes', sphereScale: 9, demoSpeed: 3, appMode: 'presentation', bogus: 1 })
    expect(s.autoplay).toBe(true)
    expect(s.sphereScale).toBe(1.6) // 夾在上限
    expect(s.demoSpeed).toBe(1)
    expect(s.appMode).toBe('presentation')
    expect('bogus' in s).toBe(false)
  })

  it('returns defaults for non-objects', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings())
    expect(sanitizeSettings('x')).toEqual(defaultSettings())
  })
})

describe('cookie round-trip', () => {
  it('stores only changed fields and restores them', () => {
    const s = { ...defaultSettings(), autoRotate: false, autoRotateSeconds: 25 }
    expect(diffFromDefaults(s)).toEqual({ autoRotate: false, autoRotateSeconds: 25 })
    expect(decodeSettings(encodeSettings(s))).toEqual(s)
  })

  it('writes path, max-age, SameSite and Secure attributes', () => {
    const jar = fakeJar()
    saveSettings({ ...defaultSettings(), tourSeen: true }, jar, opts)
    expect(jar.last).toContain('path=/crystal-scope/')
    expect(jar.last).toContain('max-age=31536000')
    expect(jar.last).toContain('SameSite=Lax')
    expect(jar.last).toContain('Secure')
    expect(loadSettings(jar)?.tourSeen).toBe(true)
  })

  it('ignores corrupt data and other versions', () => {
    const jar = fakeJar()
    jar.store.set(COOKIE_NAME, '%7Bnot-json')
    expect(loadSettings(jar)).toBeNull()
    jar.store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify({ v: 999, s: { autoplay: false } })))
    expect(loadSettings(jar)).toBeNull()
  })

  it('stays well under the 4 KB cookie limit with every field changed', () => {
    const all = sanitizeSettings({
      autoplay: false, autoRotate: false, autoRotateSeconds: 120, demoSpeed: 2, assemblyMode: 'cell3',
      appMode: 'presentation', tourSeen: true, showAxes: false, showCellEdges: false,
      showBoundaryImages: false, showBonds: false, sphereScale: 0.3,
    })
    expect(encodeSettings(all).length).toBeLessThan(1024)
  })
})
