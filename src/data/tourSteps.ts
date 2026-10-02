import { selectExample } from '../composables/selectExample'
import { playDemo } from '../composables/useDemo'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

export interface TourStep {
  /** 要高亮的元素選擇器；省略時為置中的歡迎卡。 */
  target?: string
  title: string
  body: string[]
  /** 進入此步驟時執行，讓使用者直接看到示範（沉浸式引導）。 */
  enter?: () => void
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: '歡迎來到 CrystalScope',
    body: [
      '這是一個互動式晶體結構觀察室。核心觀念只有一句：結構 = 晶格點 + 基元（Structure = Lattice point + Motif）。',
      '接下來約 1 分鐘，帶你認識每個區域。可隨時按 Esc 離開，或用 ← → 切換步驟。',
    ],
  },
  {
    target: '.system-list',
    title: '選擇範例',
    body: [
      '上方是七大晶系的示意晶胞，下方是課堂上的實際結構：BCC、FCC、HCP、NaCl、鑽石、石墨……',
      '點選任一範例，會自動播放演示動畫。',
    ],
  },
  {
    target: '.area-center',
    title: '操作 3D 模型',
    body: [
      '左鍵拖曳：旋轉｜滾輪：縮放｜右鍵拖曳：平移。',
      '觸控裝置：單指旋轉、雙指縮放與平移。頂部「重置」可回到預設視角。',
    ],
  },
  {
    target: '[data-tour="composition"]',
    title: '結構 = 晶格點 + 基元',
    body: [
      '切換「晶格點／基元／結構」三種視圖，下方表格與投影片的 Lattice point | Motif 格式相同。',
      '已為你載入 NaCl：4 個晶格點 × 基元 2 個原子 = 每個晶胞 8 個原子。',
    ],
    enter: () => {
      selectExample('nacl')
      useUiStore().viewMode = 'structure'
    },
  },
  {
    target: '[data-tour="lattice"]',
    title: '布拉菲晶格與 ½ 位置著色',
    body: [
      '同一晶系可切換簡單、底心、體心、面心晶格。勾選「依晶格點類型著色」，位於 ½ 位置的晶格點會以不同顏色呈現。',
      '已切換到立方晶系的面心 cF：綠色為面心晶格點。',
    ],
    enter: () => {
      selectExample('cubic')
      useStructureStore().setLattice('cF')
      useUiStore().colorByKind = true
    },
  },
  {
    target: '[data-tour="spheres"]',
    title: '硬球模型與晶胞裁切',
    body: [
      '金屬範例可開啟硬球接觸模型；「裁切至晶胞」會把球切開，直接看出角落佔 ⅛、面上佔 ½。',
      '已為你開啟 BCC 的硬球與裁切。',
    ],
    enter: () => {
      selectExample('bcc-fe')
      const ui = useUiStore()
      ui.hardSphere = true
      ui.clipToCell = true
      // 直接呈現裁切結果，不等建構動畫
      ui.demoOn = false
      ui.demoPlaying = false
    },
  },
  {
    target: '[data-tour="hex"]',
    title: '六方晶系：四軸與拼裝',
    body: [
      '六方晶系使用 a₁、a₂、a₃、c 四軸，三個水平軸互夾 120°。',
      '已載入 HCP 並播放拼裝動畫：先合併 6 塊，再逐層顯示原子。也可改成「3 個晶胞」拼裝，或顯示晶體外形。',
    ],
    enter: () => selectExample('hcp-mg'),
  },
  {
    target: '[data-tour="ladder"]',
    title: '尺度之旅',
    body: [
      '從 4 公分的金屬棒連續放大 10⁸ 倍：切面上的晶粒 → 單一晶粒內部 → 週期晶格 → 晶胞 → 基元。左下角的比例尺隨放大即時變化。',
      '已為你開始播放 BCC 鐵的尺度之旅；也可以拖曳進度條或用滑鼠滾輪推進。',
    ],
    enter: () => {
      selectExample('bcc-fe')
      useUiStore().ladderOn = true
      playDemo()
    },
  },
  {
    target: '.animation-bar',
    title: '演示播放列',
    body: [
      '播放、暫停、重播，或拖曳進度條停在任一階段講解；0.5× 適合課堂慢速說明。',
      '不想每次都看動畫，可取消「點選範例時自動播放」。',
    ],
    enter: () => {
      useUiStore().ladderOn = false
    },
  },
  {
    target: '[data-tour="settings"]',
    title: '共用設定',
    body: [
      '「設定」集中管理自動播放、自轉速度、演示速度、顯示選項與預設模式。',
      '設定以 cookie 保存在此瀏覽器，下次開啟會沿用；可隨時恢復預設。',
    ],
  },
  {
    target: '[data-tour="help"]',
    title: '隨時回來',
    body: [
      '「投影」模式會隱藏次要設定、放大字級，適合課堂投影。',
      '想再看一次導覽，按「說明」即可。祝探索愉快！',
    ],
  },
]
