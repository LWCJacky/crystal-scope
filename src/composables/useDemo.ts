import { computed } from 'vue'
import { demoDuration, type DemoKind } from '../core/demo'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

/** 目前適用的演示種類、長度與是否正在演示（含暫停但未結束）。 */
export function useDemo() {
  const ui = useUiStore()
  const structure = useStructureStore()

  const prismActive = computed(() => ui.hexPrism && structure.systemId === 'hexagonal' && ui.viewMode !== 'motif')
  /** 基元視圖只有一個晶格點，不需要演示。 */
  const kind = computed<DemoKind | null>(() =>
    ui.ladderOn ? 'ladder' : ui.viewMode === 'motif' ? null : prismActive.value ? 'assembly' : 'build',
  )
  const duration = computed(() => (kind.value ? demoDuration(kind.value, ui.assemblyMode) : 0))
  /** 布林值只在跨越終點時改變，因此依賴它的場景重建不會每格觸發。 */
  const running = computed(() => !!kind.value && ui.demoOn && (ui.demoPlaying || ui.demoTime < duration.value))

  return { kind, duration, running, prismActive }
}

/** 從頭播放目前範例的演示。 */
export function playDemo() {
  const ui = useUiStore()
  ui.demoOn = true
  ui.demoTime = 0
  ui.demoPlaying = true
}
