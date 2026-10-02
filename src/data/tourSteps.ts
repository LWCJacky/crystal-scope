import { selectExample } from '../composables/selectExample'
import { playDemo } from '../composables/useDemo'
import type { L10n, Locale } from '../i18n/types'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

export interface TourStep {
  /** 要高亮的元素選擇器；省略時為置中的歡迎卡。 */
  target?: string
  /** language：語言選擇步驟（三種語言各以自己的文字顯示，點選即切換並前進）。 */
  kind?: 'language'
  title: L10n
  body: Record<Locale, string[]>
  /** 進入此步驟時執行，讓使用者直接看到示範（沉浸式引導）。 */
  enter?: () => void
}

const t = (zh: string, en: string, ja: string): L10n => ({ 'zh-TW': zh, en, ja })
const b = (zh: string[], en: string[], ja: string[]): Record<Locale, string[]> => ({ 'zh-TW': zh, en, ja })

export const TOUR_STEPS: TourStep[] = [
  {
    kind: 'language',
    // 語言尚未選定，標題與說明在三種語言下皆同時呈現三語
    title: t('選擇語言 · Choose language · 言語を選択', 'Choose language · 選擇語言 · 言語を選択', '言語を選択 · Choose language · 選擇語言'),
    body: b([], [], []),
  },
  {
    title: t('歡迎來到 CrystalScope', 'Welcome to CrystalScope', 'CrystalScope へようこそ'),
    body: b(
      [
        '這是一個互動式晶體結構觀察室。核心觀念只有一句：結構 = 晶格點 + 基元（Structure = Lattice point + Motif）。',
        '接下來約 1 分鐘，帶你認識每個區域。可隨時按 Esc 離開，或用 ← → 切換步驟。',
      ],
      [
        'An interactive crystal-structure observatory built around one idea: Structure = Lattice point + Motif.',
        'The next minute walks you through each area. Press Esc to leave at any time, or ← → to change step.',
      ],
      [
        '対話型の結晶構造観察室です。中心となる考え方は一つ：構造 = 格子点 + モチーフ（Structure = Lattice point + Motif）。',
        'これから約 1 分で各エリアを紹介します。Esc でいつでも終了、← → でステップを移動できます。',
      ],
    ),
  },
  {
    target: '.system-list',
    title: t('選擇範例', 'Choose an example', '例を選ぶ'),
    body: b(
      ['上方是七大晶系的示意晶胞，下方是課堂上的實際結構：BCC、FCC、HCP、NaCl、鑽石、石墨……', '點選任一範例，會自動播放演示動畫。'],
      ['The top group holds model cells of the seven crystal systems; below are real structures from class: BCC, FCC, HCP, NaCl, diamond, graphite…', 'Selecting any example plays its demo automatically.'],
      ['上は七つの晶系の模式単位格子、下は授業で扱う実際の構造：BCC・FCC・HCP・NaCl・ダイヤモンド・黒鉛など。', '例を選ぶとデモアニメーションが自動再生されます。'],
    ),
  },
  {
    target: '.area-center',
    title: t('操作 3D 模型', 'Working the 3D model', '3D モデルの操作'),
    body: b(
      ['左鍵拖曳：旋轉｜滾輪：縮放｜右鍵拖曳：平移。', '觸控裝置：單指旋轉、雙指縮放與平移；輕點任一顆原子，鏡頭會推近並顯示它的資訊，點空白處返回。頂部「重置」可回到預設視角。'],
      ['Left-drag: rotate | wheel: zoom | right-drag: pan.', 'Touch: one finger rotates, two fingers zoom and pan; tap any atom to zoom in on it and read its details, tap empty space to go back. "Reset" restores the default view.'],
      ['左ドラッグ：回転｜ホイール：ズーム｜右ドラッグ：平行移動。', 'タッチ操作：1 本指で回転、2 本指でズームと移動。原子をタップするとズームして情報を表示し、空白をタップすると戻ります。「リセット」で既定の視点に戻ります。'],
    ),
  },
  {
    target: '[data-tour="composition"]',
    title: t('結構 = 晶格點 + 基元', 'Structure = Lattice + Motif', '構造 = 格子点 + モチーフ'),
    body: b(
      ['切換「晶格點／基元／結構」三種視圖，下方表格與投影片的 Lattice point | Motif 格式相同。', '已為你載入 NaCl：4 個晶格點 × 基元 2 個原子 = 每個晶胞 8 個原子。'],
      ['Switch between the lattice-point, motif and structure views; the table below matches the "Lattice point | Motif" layout of the slides.', 'NaCl is loaded: 4 lattice points × a 2-atom motif = 8 atoms per cell.'],
      ['「格子点／モチーフ／構造」の三つの表示を切り替えます。下の表はスライドの Lattice point | Motif と同じ形式です。', 'NaCl を読み込みました：格子点 4 個 × モチーフ 2 原子 = 単位格子あたり 8 原子。'],
    ),
    enter: () => {
      selectExample('nacl')
      useUiStore().viewMode = 'structure'
    },
  },
  {
    target: '[data-tour="lattice"]',
    title: t('布拉菲晶格與 ½ 位置著色', 'Bravais lattices and the ½ positions', 'ブラベー格子と ½ 位置の色分け'),
    body: b(
      ['同一晶系可切換簡單、底心、體心、面心晶格。勾選「依晶格點類型著色」，位於 ½ 位置的晶格點會以不同顏色呈現。', '已切換到立方晶系的面心 cF：綠色為面心晶格點。'],
      ['Within one system you can switch between primitive, base-, body- and face-centred lattices. With "colour by lattice-point type", points at ½ positions get their own colour.', 'Now showing the face-centred cubic lattice cF: green marks the face-centre points.'],
      ['同じ晶系の中で単純・底心・体心・面心格子を切り替えられます。「格子点の種類で色分け」を有効にすると、½ 位置の格子点が別の色で表示されます。', '立方晶系の面心格子 cF に切り替えました。緑が面心の格子点です。'],
    ),
    enter: () => {
      selectExample('cubic')
      useStructureStore().setLattice('cF')
      useUiStore().colorByKind = true
    },
  },
  {
    target: '[data-tour="spheres"]',
    title: t('硬球模型與晶胞裁切', 'Hard spheres and cell clipping', '剛体球モデルと単位格子での切り取り'),
    body: b(
      ['金屬範例可開啟硬球接觸模型；「裁切至晶胞」會把球切開，直接看出角落佔 ⅛、面上佔 ½。', '已為你開啟 BCC 的硬球與裁切。'],
      ['Metal examples offer the hard-sphere model; "clip to unit cell" slices the spheres so you can see ⅛ of an atom at each corner and ½ on each face.', 'The BCC example is shown with hard spheres and clipping enabled.'],
      ['金属の例では剛体球モデルを使えます。「単位格子で切り取る」と球が切断され、頂点で ⅛、面上で ½ を占めることが直接見えます。', 'BCC の例を剛体球と切り取りを有効にして表示しています。'],
    ),
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
    title: t('六方晶系：四軸與拼裝', 'Hexagonal: four axes and assembly', '六方晶系：四軸と組み立て'),
    body: b(
      ['六方晶系使用 a₁、a₂、a₃、c 四軸，三個水平軸互夾 120°。', '已載入 HCP 並播放拼裝動畫：先合併 6 塊，再逐層顯示原子。也可改成「3 個晶胞」拼裝，或顯示晶體外形。'],
      ['The hexagonal system uses four axes a₁, a₂, a₃, c; the three basal axes are 120° apart.', 'HCP is loaded with the assembly demo: six wedges merge first, then the atoms appear layer by layer. You can also assemble three unit cells, or show the crystal habit.'],
      ['六方晶系は a₁・a₂・a₃・c の四軸を使い、水平な三軸は互いに 120° をなします。', 'HCP を読み込み、組み立てデモを再生しています。まず 6 個のピースが合体し、次に原子が層ごとに現れます。「単位格子 3 個」での組み立てや結晶外形の表示も可能です。'],
    ),
    enter: () => selectExample('hcp-mg'),
  },
  {
    target: '[data-tour="ladder"]',
    title: t('尺度之旅', 'Scale journey', 'スケールの旅'),
    body: b(
      ['從 4 公分的金屬棒連續放大 10⁸ 倍：切面上的晶粒 → 表面的原子逐漸浮現 → 晶胞 → 基元，約 18 秒。晶格由 GPU 依視野即時產生，遠處自動融成實體。左下角的比例尺隨放大即時變化。', '已為你開始播放 BCC 鐵的尺度之旅；也可以拖曳進度條或用滑鼠滾輪推進。'],
      ['A continuous 10⁸× zoom from a 4 cm metal rod: grains on the cut face → atoms emerging on the surface → unit cell → motif, in about 18 seconds. The lattice is generated on the GPU as you zoom, merging into a solid at a distance. The scale bar at the bottom left updates live.', 'The scale journey for BCC iron is playing; you can also drag the progress bar or scroll the mouse wheel.'],
      ['4 cm の金属棒から 10⁸ 倍まで連続ズーム：断面の結晶粒 → 表面に現れる原子 → 単位格子 → モチーフ、約 18 秒。格子は視野に応じて GPU で生成され、遠方は固体に溶け込みます。左下のスケールバーはリアルタイムに変化します。', 'BCC 鉄のスケールの旅を再生しています。進行バーのドラッグやマウスホイールでも進められます。'],
    ),
    enter: () => {
      selectExample('bcc-fe')
      useUiStore().ladderOn = true
      playDemo()
    },
  },
  {
    target: '.animation-bar',
    title: t('演示播放列', 'Demo bar', 'デモバー'),
    body: b(
      ['播放、暫停、重播，或拖曳進度條停在任一階段講解；0.5× 適合課堂慢速說明。', '不想每次都看動畫，可取消「點選範例時自動播放」。'],
      ['Play, pause, replay, or drag the progress bar to pause at any stage while you explain; 0.5× suits slow classroom walkthroughs.', 'If you would rather not watch the demo every time, untick "autoplay when an example is selected".'],
      ['再生・一時停止・もう一度、または進行バーをドラッグして任意の段階で止めて解説できます。0.5× は授業でのゆっくりした説明に向いています。', '毎回アニメーションを見たくない場合は「例を選ぶと自動再生」を外してください。'],
    ),
    enter: () => {
      useUiStore().ladderOn = false
    },
  },
  {
    target: '[data-tour="settings"]',
    title: t('共用設定', 'Shared settings', '共通設定'),
    body: b(
      ['「設定」集中管理自動播放、自轉速度、演示速度、顯示選項、語言與預設模式。', '設定以 cookie 保存在此瀏覽器，下次開啟會沿用；可隨時恢復預設。'],
      ['"Settings" gathers autoplay, rotation speed, demo speed, display options, language and the default mode in one place.', 'They are saved in a cookie in this browser and reused next time; you can restore the defaults at any point.'],
      ['「設定」では自動再生・回転速度・デモ速度・表示オプション・言語・既定モードをまとめて管理します。', '設定はこのブラウザの Cookie に保存され、次回も引き継がれます。いつでも既定値に戻せます。'],
    ),
  },
  {
    target: '[data-tour="help"]',
    title: t('隨時回來', 'Come back any time', 'いつでも戻れます'),
    body: b(
      ['「投影」模式會隱藏次要設定、放大字級，適合課堂投影。', '想再看一次導覽，按「說明」即可。祝探索愉快！'],
      ['"Present" mode hides secondary settings and enlarges the text for classroom projection.', 'To see this tour again, press "Help". Enjoy exploring!'],
      ['「投影」モードは補助的な設定を隠し、文字を大きくして教室での投影に適した表示にします。', 'このガイドをもう一度見るには「ヘルプ」を押してください。探索をお楽しみください！'],
    ),
  },
]
