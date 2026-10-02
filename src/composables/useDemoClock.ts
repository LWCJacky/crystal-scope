import { onBeforeUnmount, watch } from 'vue'
import { useUiStore } from '../stores/ui'
import { useDemo } from './useDemo'

/** 演示動畫的時鐘：播放時以 requestAnimationFrame 推進時間，到終點自動停止。只在 App 掛載一次。 */
export function useDemoClock() {
  const ui = useUiStore()
  const { kind, duration } = useDemo()
  let frame = 0
  let last = 0

  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000) // 分頁切回時避免一次跳太遠
    last = now
    ui.demoTime = Math.min(duration.value, ui.demoTime + dt * ui.demoSpeed)
    if (ui.demoTime >= duration.value) ui.demoPlaying = false
    else frame = requestAnimationFrame(tick)
  }

  watch(
    () => ui.demoPlaying,
    (playing) => {
      cancelAnimationFrame(frame)
      if (!playing) return
      if (ui.demoTime >= duration.value) ui.demoTime = 0
      last = performance.now()
      frame = requestAnimationFrame(tick)
    },
    // 首次載入時 demoPlaying 已為 true，需立即啟動
    { immediate: true },
  )

  // 演示種類改變（例如切換基元視圖、勾選六方柱）時，時間軸已不對應新的演示：
  // 播放中則從頭重播；否則直接顯示完成狀態，避免停在「進行中但未播放」的空白畫面
  watch(kind, () => {
    if (ui.demoPlaying && kind.value) ui.demoTime = 0
    else {
      ui.demoOn = false
      ui.demoPlaying = false
    }
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))
}
