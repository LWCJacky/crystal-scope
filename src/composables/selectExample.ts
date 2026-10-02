import { findExample } from '../data/examples'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'
import { playDemo } from './useDemo'

/** 載入範例並重設與範例相關的顯示設定；依偏好自動播放演示。列表與導覽共用。 */
export function selectExample(id: string) {
  const structure = useStructureStore()
  const ui = useUiStore()
  const example = findExample(id)
  structure.loadExample(id)
  // 晶系示意晶胞預設依晶格點類型著色；材料範例依元素著色
  ui.colorByKind = example.group === 'system'
  ui.hardSphere = false
  ui.clipToCell = false
  // 六方晶系預設以六方柱呈現四軸與六次對稱
  ui.hexPrism = example.systemId === 'hexagonal'
  ui.cRotationSteps = 0
  // 手機版：選完範例收合面板，讓使用者直接看到演示
  ui.sheet = null
  if (ui.autoplay) playDemo()
  else {
    ui.demoOn = false
    ui.demoPlaying = false
  }
}
