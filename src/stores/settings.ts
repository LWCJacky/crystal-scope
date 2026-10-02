import { acceptHMRUpdate, defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { loadSettings, saveSettings } from '../config/cookieStorage'
import { defaultSettings, sanitizeSettings, type Settings } from '../config/settings'

/** 先前版本存在 localStorage 的偏好；第一次載入時搬進 cookie 後刪除。 */
const LEGACY_KEYS = { autoplay: 'crystalscope.autoplay', autoRotate: 'crystalscope.autoRotate', tourSeen: 'crystalscope.tourSeen' }

function migrateLegacy(): Settings | null {
  try {
    const found: Record<string, boolean> = {}
    for (const [key, storageKey] of Object.entries(LEGACY_KEYS)) {
      const v = localStorage.getItem(storageKey)
      if (v !== null) found[key] = v === '1'
      localStorage.removeItem(storageKey)
    }
    return Object.keys(found).length ? sanitizeSettings(found) : null
  } catch {
    return null
  }
}

const SAVE_DELAY_MS = 250

/** 全站共用設定：由 cookie 載入、變更後（防抖）寫回 cookie。 */
export const useSettingsStore = defineStore('settings', () => {
  const stored = loadSettings()
  const migrated = stored ? null : migrateLegacy()
  const values = reactive<Settings>(stored ?? migrated ?? defaultSettings())
  // 只在使用者實際更改設定（或從舊版遷移）時才寫入 cookie；單純瀏覽不留下 cookie
  if (migrated) saveSettings({ ...values })

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    values,
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => saveSettings({ ...values }), SAVE_DELAY_MS)
    },
    { deep: true },
  )

  /** 恢復所有預設值；導覽狀態保留，避免重設後又自動跳出導覽。 */
  function reset() {
    Object.assign(values, { ...defaultSettings(), tourSeen: values.tourSeen })
  }

  return { values, reset }
})

// 開發時熱更新 store 定義，避免元件已換新程式碼而 store 仍為舊版本
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
