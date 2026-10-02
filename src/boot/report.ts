import type { BootStage } from './boot.js'

interface BootApi {
  report(stage: BootStage, fraction?: number): void
  ready(): void
  fail(code: string, detail?: string): void
}

const api = (): BootApi | undefined => (window as unknown as { __csBoot?: BootApi }).__csBoot

/** 主程式向啟動層回報進度；啟動層不存在（例如測試）時靜默。 */
export const bootReport = (stage: BootStage, fraction = 1) => api()?.report(stage, fraction)
export const bootReady = () => api()?.ready()
export const bootFail = (code: string, detail?: string) => api()?.fail(code, detail)

/** 啟動層是否已經結束（可能在本模組載入前就已移除）。 */
export const bootDone = () => !document.getElementById('boot')

/** 等待啟動層結束後執行（已結束則立即執行）。 */
export function afterBoot(fn: () => void) {
  if (bootDone()) fn()
  else document.addEventListener('cs:boot-done', fn, { once: true })
}
