import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AppMode = 'explore' | 'presentation'

/** 介面與顯示設定，與可復原的結構狀態分開。 */
export const useUiStore = defineStore('ui', () => {
  const mode = ref<AppMode>('explore')
  const showAxes = ref(true)
  const showCellEdges = ref(true)
  /** 由「重置」或切換晶系遞增，通知檢視區回到預設視角。 */
  const viewResetToken = ref(0)

  function requestViewReset() {
    viewResetToken.value++
  }

  return { mode, showAxes, showCellEdges, viewResetToken, requestViewReset }
})
