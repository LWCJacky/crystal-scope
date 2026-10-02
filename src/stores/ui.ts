import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, toRef } from 'vue'
import { useSettingsStore } from './settings'

export type AppMode = 'explore' | 'presentation'
/**
 * Structure = Lattice point + Motif：三種視圖分別呈現晶格點、單一晶格點的基元、完整結構。
 * 晶格點不必然是一顆原子，視覺上與原子明確區分。
 */
export type ViewMode = 'latticePoints' | 'motif' | 'structure'

/** 介面與顯示設定，與可復原的結構狀態分開。 */
export const useUiStore = defineStore('ui', () => {
  // 需要保留的偏好直接綁定到共用設定集（cookie），其餘為本次瀏覽的暫時狀態
  const settings = useSettingsStore().values
  const mode = toRef(settings, 'appMode')
  const showAxes = toRef(settings, 'showAxes')
  const showCellEdges = toRef(settings, 'showCellEdges')
  const viewMode = ref<ViewMode>('structure')
  /** 依晶格點類型（角落／底心／體心／面心）著色；關閉時依元素著色。 */
  const colorByKind = ref(true)
  /** 結構視圖中疊加晶格點，並以虛線連到各自關聯的基元原子（association）。 */
  const showAssociation = ref(false)
  const showBonds = toRef(settings, 'showBonds')
  /** 在原點標示晶軸夾角 α、β、γ（弧線或直角記號）。 */
  const showAngles = toRef(settings, 'showAngles')
  /** 投影方式：透視或正交（正交時沿晶軸觀看，前後原子完全重疊）。 */
  const projection = toRef(settings, 'projection')
  /** 球體大小倍率（示意）。 */
  const sphereScale = toRef(settings, 'sphereScale')
  /** 硬球接觸模型：半徑 = 最近鄰距離 / 2，僅單一元素金屬可用。 */
  const hardSphere = ref(false)
  /** 以晶胞邊界裁切球體，呈現角落 1/8、面上 1/2 等佔有比例。 */
  const clipToCell = ref(false)
  /** 六方晶系：以 3 個晶胞組成的六方柱呈現。 */
  const hexPrism = ref(false)
  /** 六方晶系：顯示四軸 a₁、a₂、a₃、c 與 120° 角。 */
  const hexAxes = ref(true)
  /** 六方晶系：顯示理想化晶體外形（六方柱＋雙錐）。 */
  const showHabit = ref(false)
  /** 繞 c 軸旋轉的 60° 步數。 */
  const cRotationSteps = ref(0)
  /** 尺度之旅：由巨觀物件連續放大到晶胞與基元（取代一般檢視，直到離開）。 */
  const ladderOn = ref(false)
  /** 演示動畫：點選範例時自動播放（六方晶系為拼裝，其餘為建構動畫）。 */
  const demoOn = ref(settings.autoplay)
  const assemblyMode = toRef(settings, 'assemblyMode')
  /** 動畫時間（秒，1× 速度下的時間軸位置）。 */
  const demoTime = ref(0)
  /** 首次載入即播放預設範例的演示。 */
  const demoPlaying = ref(settings.autoplay)
  const demoSpeed = toRef(settings, 'demoSpeed')
  /** 點選範例時自動播放演示。 */
  const autoplay = toRef(settings, 'autoplay')
  /** 演示完成後模型自動繞 c 軸旋轉（偏好）；autoRotating 為目前是否正在自轉。 */
  const autoRotatePref = toRef(settings, 'autoRotate')
  const autoRotateSeconds = toRef(settings, 'autoRotateSeconds')
  const autoRotating = ref(false)
  /** 使用導覽：第一次造訪自動開啟，之後可由「說明」重開。 */
  const tourOpen = ref(false)
  const tourStep = ref(0)
  const tourSeen = toRef(settings, 'tourSeen')

  function openTour() {
    tourStep.value = 0
    tourOpen.value = true
  }

  function closeTour() {
    tourOpen.value = false
    tourSeen.value = true
  }

  /** 由「重置」或切換晶系遞增，通知檢視區回到預設視角。 */
  const viewResetToken = ref(0)

  function requestViewReset() {
    viewResetToken.value++
  }

  return {
    mode,
    showAxes,
    showCellEdges,
    viewMode,
    colorByKind,
    showAssociation,
    showBonds,
    showAngles,
    projection,
    sphereScale,
    hardSphere,
    clipToCell,
    hexPrism,
    hexAxes,
    showHabit,
    cRotationSteps,
    ladderOn,
    demoOn,
    assemblyMode,
    demoTime,
    demoPlaying,
    demoSpeed,
    autoplay,
    autoRotatePref,
    autoRotateSeconds,
    autoRotating,
    tourOpen,
    tourStep,
    tourSeen,
    openTour,
    closeTour,
    viewResetToken,
    requestViewReset,
  }
})

// 開發時熱更新 store 定義，避免元件已換新程式碼而 store 仍為舊版本
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
