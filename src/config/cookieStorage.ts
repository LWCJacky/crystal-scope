import { diffFromDefaults, sanitizeSettings, type Settings } from './settings'

export const COOKIE_NAME = 'crystalscope_settings'
/** 資料格式版本；格式不相容時遞增，舊資料即被忽略。 */
export const SETTINGS_VERSION = 1
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/** 抽象化 document.cookie，方便測試。 */
export interface CookieJar {
  read(): string
  write(cookie: string): void
}

const browserJar: CookieJar = {
  read: () => document.cookie,
  write: (cookie) => {
    document.cookie = cookie
  },
}

interface CookieOptions {
  /** 部署於 GitHub Pages 子路徑時，cookie 路徑需與網站路徑一致。 */
  path: string
  secure: boolean
}

function defaultOptions(): CookieOptions {
  return {
    path: import.meta.env?.BASE_URL ?? '/',
    secure: typeof location !== 'undefined' && location.protocol === 'https:',
  }
}

export function encodeSettings(settings: Settings): string {
  return encodeURIComponent(JSON.stringify({ v: SETTINGS_VERSION, s: diffFromDefaults(settings) }))
}

export function decodeSettings(value: string | null): Settings | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    if (parsed?.v !== SETTINGS_VERSION) return null
    return sanitizeSettings(parsed.s)
  } catch {
    return null
  }
}

export function readCookieValue(name: string, jar: CookieJar = browserJar): string | null {
  try {
    for (const part of jar.read().split(';')) {
      const [k, ...rest] = part.trim().split('=')
      if (k === name) return rest.join('=')
    }
  } catch {
    // cookie 被封鎖時視為無資料
  }
  return null
}

export function loadSettings(jar: CookieJar = browserJar): Settings | null {
  return decodeSettings(readCookieValue(COOKIE_NAME, jar))
}

export function saveSettings(settings: Settings, jar: CookieJar = browserJar, options = defaultOptions()) {
  const attrs = [`path=${options.path}`, `max-age=${MAX_AGE_SECONDS}`, 'SameSite=Lax']
  if (options.secure) attrs.push('Secure')
  try {
    jar.write(`${COOKIE_NAME}=${encodeSettings(settings)}; ${attrs.join('; ')}`)
  } catch {
    // 無法寫入（例如封鎖 cookie）時，設定仍在本次瀏覽中有效
  }
}

export function clearSettingsCookie(jar: CookieJar = browserJar, options = defaultOptions()) {
  try {
    jar.write(`${COOKIE_NAME}=; path=${options.path}; max-age=0; SameSite=Lax`)
  } catch {
    // 忽略
  }
}
