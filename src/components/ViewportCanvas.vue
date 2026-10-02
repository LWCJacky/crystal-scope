<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { directionVector, validateIndices } from '../core/direction'
import { pieceCentroidAngle, pieceCount, pieceOutline, pieceSolid } from '../core/assembly'
import { demoState, LADDER_DURATION } from '../core/demo'
import { cellAngleMarks, formatDegrees } from '../core/angles'
import { cubeHabit, octahedronHabit, parallelepipedHabit, polyhedronExtent, type Polyhedron } from '../core/habit'
import { angleArc, hexagonalAxes, hexagonalHabit, hexPrismEdges } from '../core/hexagonal'
import { cellClipPlanes, fracToCart } from '../core/lattice'
import { findBonds } from '../core/neighbors'
import { generateCellEdges, generateImages, generateLatticePoints, LATTICE_POINT_ID } from '../core/periodic'
import { buildLadderProfile, formatLength, ladderState, scaleBar, type LadderProfile } from '../core/scaleLadder'
import type { AtomImage, RepeatSettings, Vec3 } from '../core/types'
import { elementStyle } from '../data/elements'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import { useDemo } from '../composables/useDemo'
import { useReducedMotion } from '../composables/useReducedMotion'
import {
  CrystalRenderer,
  type LadderStageScene,
  type MacroObject,
  type SceneAtom,
  type SceneAxis,
  type SceneData,
  type SceneLabel,
  type ScenePiece,
} from '../render/CrystalRenderer'
import { useStructureStore } from '../stores/structure'
import { useUiStore, type ViewMode } from '../stores/ui'

const structure = useStructureStore()
const ui = useUiStore()
const host = ref<HTMLDivElement>()
let renderer: CrystalRenderer | null = null

const LATTICE_POINT_COLOR = '#c9ced8'
const AXIS_COLORS = ['#d94848', '#3c9a4a', '#3b6fd1']
/** 四軸系統沿用常見教材配色：三個等價水平軸同色，c 軸另色。 */
const HEX_A_COLOR = '#e0458a'
const HEX_C_COLOR = '#c0392b'
const HABIT_COLOR = '#e3b23c'
/** 夾角弧線與文字（與 120° 標示共用）。 */
const ANGLE_LINE_COLOR = '#5b6cf0'
const ANGLE_TEXT_COLOR = '#8f9cff'
/** 尺度之旅：金屬棒與單晶外形的顏色。 */
const ROD_COLOR = '#9aa3ad'
const CRYSTAL_COLOR = '#8fb8e8'

const demo = useDemo()
/** 六方柱模式（與 useDemo 共用同一判斷）。 */
const prismActive = () => demo.prismActive.value
const layers = () => structure.repeat.repeatC
/** 尺度之旅進行中（含暫停）。 */
const ladderActive = () => ui.ladderOn && demo.kind.value === 'ladder'
/** 各塊外框的區分色（等距色相，兩種主題皆可辨識）。 */
const PIECE_COLORS = ['#e0458a', '#e0803c', '#d6b23a', '#3fae6a', '#3b9ad9', '#8a6fe0']
const reducedMotion = useReducedMotion()
/** 網路字體載入完成後重建一次場景，讓 3D 文字標籤改用 Nunito。 */
const fontsReady = ref(false)

/**
 * 場景組裝的覆寫：尺度之旅各級以固定的檢視、週期與顯示設定組裝，
 * 不受右側面板目前的狀態影響；一般檢視則全部取自 ui／structure。
 */
interface SceneOverrides {
  viewMode: ViewMode
  repeat: Vec3
  boundaryImages: boolean
  showAxes: boolean
  showAngles: boolean
  showCellEdges: boolean
}

/** 基元視圖只顯示一個晶胞；其他視圖依週期設定。 */
function blockCorner(viewMode: ViewMode, repeat?: Vec3): Vec3 {
  if (repeat) return repeat
  if (viewMode === 'motif') return [1, 1, 1]
  const r = structure.repeat
  return [r.repeatA, r.repeatB, r.repeatC]
}

function buildScene(over?: SceneOverrides): SceneData {
  const basis = structure.latticeBasis
  const example = structure.source
  const { a, b, c } = structure.cell
  const minLen = Math.min(a, b, c)
  const viewMode = over?.viewMode ?? ui.viewMode
  const corner = blockCorner(viewMode, over?.repeat)
  const toCart = (f: Vec3) => fracToCart(basis, f)
  const atomsById = new Map(structure.basis.map((atom) => [atom.id, atom]))
  const showAxes = over?.showAxes ?? ui.showAxes
  const showAngles = over?.showAngles ?? ui.showAngles
  const showAssociation = over ? false : ui.showAssociation

  // 球體半徑：硬球接觸模型（最近鄰距離 / 2）或示意大小
  const contact = ui.hardSphere && example.hardSphere ? structure.nearestNeighbor / 2 : null
  const radiusOf = (element: string) =>
    contact ?? (element === 'X' ? 0.12 * minLen : elementStyle(element).displayRadius) * ui.sphereScale
  const latticePointRadius = 0.06 * minLen
  const kindColor = (img: AtomImage, fallback: string) => (ui.colorByKind ? LATTICE_POINT_KINDS[img.kind].color : fallback)

  const latticePointAtom = (img: AtomImage, boundary = img.isBoundaryImage): SceneAtom => ({
    baseId: img.baseId,
    position: toCart(img.fractionalPosition),
    color: kindColor(img, LATTICE_POINT_COLOR),
    radius: latticePointRadius,
    isBoundaryImage: boundary,
  })

  const atoms: SceneAtom[] = []
  const links: [Vec3, Vec3][] = []
  const bondCandidates: { element: string; position: Vec3 }[] = []
  const prism = over ? false : prismActive()
  const demoRunning = over ? false : demo.running.value
  const clipping = !over && ui.clipToCell && viewMode === 'structure' && !prism && !demoRunning

  // 原子複本與晶格點：覆寫時依指定的週期自行產生；否則用 store 的快取
  let images: AtomImage[]
  let latticePoints: AtomImage[]
  if (over) {
    const repeat: RepeatSettings = { repeatA: corner[0], repeatB: corner[1], repeatC: corner[2], showBoundaryImages: over.boundaryImages }
    images = generateImages(structure.basis, repeat, structure.lattice.centering)
    latticePoints = generateLatticePoints(repeat, structure.lattice.centering)
  } else {
    images = prism ? structure.prismImages : clipping ? structure.imagesWithMargin : structure.images
    latticePoints = prism ? structure.prismLatticePoints : structure.latticePoints
  }

  if (viewMode === 'latticePoints') {
    atoms.push(...latticePoints.map((img) => latticePointAtom(img)))
  } else if (viewMode === 'motif') {
    // 一個晶格點（原點）＋與它關聯的基元原子，使用未折返的基元座標
    const origin: Vec3 = [0, 0, 0]
    atoms.push({ baseId: LATTICE_POINT_ID, position: origin, color: LATTICE_POINT_COLOR, radius: latticePointRadius, isBoundaryImage: false })
    for (const atom of structure.basis) {
      const position = toCart(atom.fractionalPosition)
      atoms.push({ baseId: atom.id, position, color: elementStyle(atom.element).color, radius: radiusOf(atom.element), isBoundaryImage: false })
      bondCandidates.push({ element: atom.element, position })
      links.push([origin, position])
    }
  } else {
    for (const img of images) {
      const atom = atomsById.get(img.baseId)!
      const position = toCart(img.fractionalPosition)
      atoms.push({
        baseId: img.baseId,
        position,
        color: kindColor(img, atom.color ?? elementStyle(atom.element).color),
        radius: atom.displayRadius ?? radiusOf(atom.element),
        // 裁切模式以實心呈現被切開的部分；疊加關聯線時原子半透明，讓重合的晶格點（如 HCP 原點）可見
        isBoundaryImage: clipping ? false : showAssociation || img.isBoundaryImage,
      })
      bondCandidates.push({ element: atom.element, position })
      if (showAssociation) links.push([toCart(img.latticePoint), position])
    }
    if (showAssociation) atoms.push(...latticePoints.map((img) => latticePointAtom(img, false)))
  }

  const rules = ui.showBonds && !contact ? (example.bonds ?? []) : []
  const bonds = findBonds(bondCandidates, rules).map(([i, j]) => [bondCandidates[i].position, bondCandidates[j].position] as [Vec3, Vec3])

  let arrow: SceneData['arrow'] = null
  const d = structure.direction
  if (!over && structure.directionEnabled && validateIndices(d.u, d.v, d.w).valid) {
    const v = directionVector(basis, d.u, d.v, d.w)
    arrow = { origin: toCart(d.origin), vector: v.map((x) => x * d.displayLength) as Vec3 }
  }

  const repeat = { repeatA: corner[0], repeatB: corner[1], repeatC: corner[2], showBoundaryImages: false }
  const toCartPair = ([p, q]: [Vec3, Vec3]): [Vec3, Vec3] => [toCart(p), toCart(q)]
  const prismEdges = prism ? hexPrismEdges(layers()) : null

  // 座標軸：一般為 a、b、c；六方柱模式為四軸 a₁、a₂、a₃、c，並標出 120°
  const origin: Vec3 = [0, 0, 0]
  let axes: SceneAxis[] = [basis.a, basis.b, basis.c].map((v, i) => ({
    origin,
    vector: v.map((x) => x * 1.25) as Vec3,
    color: AXIS_COLORS[i],
    label: 'abc'[i],
  }))
  const polylines: SceneData['polylines'] = []
  const labels: SceneLabel[] = []
  if (prism && ui.hexAxes) {
    const { a1, a2, a3, c: cv } = hexagonalAxes(basis)
    const scaled = (v: Vec3, k: number) => v.map((x) => x * k) as Vec3
    axes = [
      { origin, vector: scaled(a1, 1.3), color: HEX_A_COLOR, label: 'a₁' },
      { origin, vector: scaled(a2, 1.3), color: HEX_A_COLOR, label: 'a₂' },
      { origin, vector: scaled(a3, 1.3), color: HEX_A_COLOR, label: 'a₃' },
      { origin, vector: scaled(cv, layers() * 1.2), color: HEX_C_COLOR, label: 'c' },
    ]
    const r = Math.hypot(...a1) * 0.32
    for (const [p, q] of [[a1, a2], [a2, a3], [a3, a1]] as [Vec3, Vec3][]) {
      const arc = angleArc(p, q, r)
      polylines.push({ points: arc, color: ANGLE_LINE_COLOR })
      const mid = arc[Math.floor(arc.length / 2)]
      labels.push({ text: '120°', position: scaled(mid, 1.55), color: ANGLE_TEXT_COLOR })
    }
  } else if (showAngles && showAxes) {
    // 一般晶胞：於原點標示 α、β、γ，直角以 ⌐ 記號、其餘以雙箭頭弧線
    // 弧線需繞過原點的原子：半徑取晶胞尺度與最大球半徑的較大者，並限制不超過晶胞
    const largest = atoms.reduce((r, at) => Math.max(r, at.radius), 0)
    const arcRadius = Math.min(minLen * 0.6, Math.max(minLen * 0.42, largest * 1.6))
    for (const m of cellAngleMarks(basis, arcRadius)) {
      polylines.push({ points: m.path, color: ANGLE_LINE_COLOR })
      for (const [p, q] of m.arrowheads) polylines.push({ points: [p, q], color: ANGLE_LINE_COLOR })
      labels.push({ text: `${m.name} ${formatDegrees(m.degrees)}`, position: m.labelPosition, color: ANGLE_TEXT_COLOR })
    }
  }

  // 演示模式：拼裝（先合併各塊形狀，再逐層顯示原子）或建構（晶格點 → 基元原子）
  let pieces: ScenePiece[] | null = null
  let atomLayers: SceneAtom[][] = []
  let latticeLayers: SceneAtom[][] = []
  if (demoRunning && demo.kind.value === 'assembly') {
    const mode = ui.assemblyMode
    const n = pieceCount(mode)
    pieces = Array.from({ length: n }, (_, k) => {
      const solid = pieceSolid(k, mode, layers())
      return {
        solid: { vertices: solid.vertices.map(toCart), faces: solid.faces },
        edges: pieceOutline(k, mode, layers()).map(toCartPair),
        color: PIECE_COLORS[(k * (6 / n)) % 6],
        centroidAngle: pieceCentroidAngle(k, mode),
      }
    })
    atomLayers = groupByHeight(atoms)
  } else if (demoRunning && demo.kind.value === 'build') {
    if (viewMode === 'latticePoints') latticeLayers = groupByHeight(atoms)
    else {
      atomLayers = groupByHeight(atoms.filter((a) => a.baseId !== LATTICE_POINT_ID))
      latticeLayers = groupByHeight(latticePoints.map((img) => latticePointAtom(img)))
    }
  }
  if (demoRunning) {
    demoCounts = { atomLayers: atomLayers.length, latticeLayers: latticeLayers.length }
    atoms.length = 0
    links.length = 0
  }

  const habit = prism && ui.showHabit ? { ...hexagonalHabit(basis, layers()), color: HABIT_COLOR } : null

  return {
    axes,
    atoms,
    cellEdges: pieces ? [] : prismEdges ? prismEdges.outline.map(toCartPair) : generateCellEdges(repeat).map(toCartPair),
    secondaryEdges: prismEdges && !pieces ? prismEdges.cellDividers.map(toCartPair) : [],
    demo: demoRunning,
    pieces,
    atomLayers,
    latticeLayers,
    pieceOffset: Math.hypot(...basis.a) * 1.6,
    polylines,
    labels,
    labelSize: 0.38 * minLen,
    polyhedron: habit,
    center: prism ? toCart([0, 0, layers() / 2]) : toCart(corner.map((n) => n / 2) as Vec3),
    arrow,
    bonds,
    bondRadius: 0.02 * minLen,
    links,
    linkDash: 0.04 * minLen,
    clipPlanes: clipping ? cellClipPlanes(basis, corner) : null,
    showAxes,
    showCellEdges: over?.showCellEdges ?? ui.showCellEdges,
  }
}

/** 依高度分層（由下往上），供逐層淡入。 */
function groupByHeight(list: SceneAtom[]): SceneAtom[][] {
  const byHeight = new Map<string, SceneAtom[]>()
  for (const atom of list) {
    // 淡色邊界複本另成一層，演示中維持其透明度，結束時不會突然變淡
    const key = `${atom.position[2].toFixed(4)}|${atom.isBoundaryImage ? 1 : 0}`
    byHeight.set(key, [...(byHeight.get(key) ?? []), atom])
  }
  return [...byHeight.entries()]
    .sort((p, q) => parseFloat(p[0]) - parseFloat(q[0]))
    .map(([, layer]) => layer)
}

/** 目前場景各類的層數；由 buildScene 更新，不放進響應式狀態以免觸發重建。 */
let demoCounts = { atomLayers: 0, latticeLayers: 0 }

function applyDemoState() {
  const kind = demo.kind.value
  if (!kind || kind === 'ladder') return
  renderer?.setDemoState(demoState(kind, ui.assemblyMode, ui.demoTime, demoCounts, reducedMotion.value))
}

// ───────────────────────── 尺度之旅 ─────────────────────────

const BLOCK_CELLS = 5
/** 金屬棒半徑 1 單位 = 1 cm；晶粒種子密度 200/單位 → 晶粒約 50 µm。 */
const ROD_RADIUS = 1
const ROD_LENGTH = 3
const GRAIN_SEEDS_PER_UNIT = 200
const ROD_METRES_PER_UNIT = 0.01
const MACRO_SIZE_METRES = 0.02
/** 預設視角方向（與渲染層一致）；巨觀物件朝向相機的一面須落在原點。 */
const VIEW_DIR: Vec3 = (() => {
  const v: Vec3 = [0.8, -1, 0.6]
  const n = Math.hypot(...v)
  return [v[0] / n, v[1] / n, v[2] / n]
})()
const ROD_AXIS: Vec3 = [VIEW_DIR[0], VIEW_DIR[1], VIEW_DIR[2] + 0.4]

interface LadderBuild {
  stages: LadderStageScene[]
  profile: LadderProfile
  /** 原點晶格點在對齊後的位置（晶胞中心為原點），供相機目標插值。 */
  cornerTarget: Vec3
  polycrystalline: boolean
}

/** 巨觀單晶外形：依晶系選常見晶癖；中心在原點、尺寸約 2 單位。 */
function macroHabit(): Polyhedron & { offsetZ: number } {
  const basis = structure.latticeBasis
  const system = structure.systemId
  const id = structure.exampleId
  if (system === 'hexagonal') {
    const h = hexagonalHabit(basis, 1)
    return { ...h, offsetZ: -basis.c[2] / 2 }
  }
  if (system === 'cubic') return { ...(id === 'diamond' ? octahedronHabit(2) : cubeHabit(2)), offsetZ: 0 }
  const raw = parallelepipedHabit(basis, 1)
  return { ...parallelepipedHabit(basis, 2 / polyhedronExtent(raw)), offsetZ: 0 }
}

function buildLadder(): LadderBuild {
  const basis = structure.latticeBasis
  const toCart = (f: Vec3) => fracToCart(basis, f)
  // 示意晶系的晶胞長度沒有單位，比例尺以 1 單位 = 1 Å 計算並註明
  const cellMetres = structure.cell.a * 1e-10
  const polycrystalline = !!structure.source.polycrystalline

  let macro: MacroObject
  let macroOffset: Vec3 = [0, 0, 0]
  let macroMetresPerUnit: number
  if (polycrystalline) {
    // 棒軸相對視線傾斜約 22°，起點時看得到側面，讀起來是「一根棒」而不是圓盤
    macro = { kind: 'rod', radius: ROD_RADIUS, length: ROD_LENGTH, seedsPerUnit: GRAIN_SEEDS_PER_UNIT, axis: ROD_AXIS, color: ROD_COLOR }
    macroMetresPerUnit = ROD_METRES_PER_UNIT
  } else {
    const habit = macroHabit()
    macro = { kind: 'solid', polyhedron: habit, color: CRYSTAL_COLOR }
    // 相機沿 VIEW_DIR 推向原點：把外形最靠近相機的頂點移到原點，相機才會貼近表面而不是進入內部
    let support = -Infinity
    let supportPoint: Vec3 = [0, 0, 0]
    for (const v of habit.vertices) {
      const q: Vec3 = [v[0], v[1], v[2] + habit.offsetZ]
      const dot = q[0] * VIEW_DIR[0] + q[1] * VIEW_DIR[1] + q[2] * VIEW_DIR[2]
      if (dot > support) {
        support = dot
        supportPoint = q
      }
    }
    macroOffset = [-supportPoint[0], -supportPoint[1], habit.offsetZ - supportPoint[2]]
    macroMetresPerUnit = MACRO_SIZE_METRES / polyhedronExtent(habit)
  }

  const half = BLOCK_CELLS / 2
  const cellCentre = toCart([0.5, 0.5, 0.5])
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]
  const lattice = (viewMode: ViewMode, repeat: number, boundary: boolean, axes: boolean): SceneData =>
    buildScene({ viewMode, repeat: [repeat, repeat, repeat], boundaryImages: boundary, showAxes: axes, showAngles: axes, showCellEdges: true })

  return {
    stages: [
      { id: 'macro', macro, offset: macroOffset },
      // 區塊中心與中央晶胞的中心重合：5 格時中央晶胞 [2,3] 的中心正是 2.5
      { id: 'block', data: lattice('structure', BLOCK_CELLS, false, false), offset: neg(toCart([half, half, half])) },
      { id: 'cell', data: lattice('structure', 1, true, true), offset: neg(cellCentre) },
      // 基元級只保留晶胞邊線；座標軸與夾角由晶胞級負責並在此前淡出，避免兩級重疊時標籤疊加
      { id: 'motif', data: lattice('motif', 1, false, false), offset: neg(cellCentre) },
    ],
    profile: buildLadderProfile(cellMetres, macroMetresPerUnit),
    cornerTarget: neg(cellCentre),
    polycrystalline,
  }
}

let ladder: LadderBuild | null = null
const ladderHeightMetres = ref(0)
const ladderStageId = ref<string>('macro')
const hostHeight = ref(600)

function applyLadder() {
  if (!ladder || !renderer) return
  const zoom = Math.min(1, Math.max(0, ui.demoTime / LADDER_DURATION))
  const state = ladderState(ladder.profile, zoom, reducedMotion.value)
  const t = state.targetBlend
  const latticeTarget = ladder.cornerTarget.map((c) => c * t) as Vec3
  renderer.setLadderView({ stages: state.stages, latticeTarget })
  ladderHeightMetres.value = state.heightMetres
  // 說明文字取「最靠近原子尺度且已明顯可見」的一級
  ladderStageId.value = [...state.stages].reverse().find((s) => s.opacity >= 0.5)?.id ?? 'macro'
}

const STAGE_NAMES: Record<string, string> = {
  macro: '巨觀物件',
  block: '週期晶格（5×5×5 晶胞）',
  cell: '單一晶胞',
  motif: '晶格點 + 基元',
}
const scaleBarInfo = computed(() => {
  const h = ladderHeightMetres.value
  if (!h) return null
  const bar = scaleBar(h)
  return { label: formatLength(bar.metres), widthPx: bar.fraction * hostHeight.value, height: formatLength(h) }
})
const ladderCaption = computed(() => {
  const stage = STAGE_NAMES[ladderStageId.value]
  if (ladderStageId.value !== 'macro') return stage
  return ladder?.polycrystalline ? `${stage}：切開的多晶金屬棒，切面可見晶粒` : `${stage}：單晶外形`
})
const ladderCaveat = computed(() =>
  structure.source.lengthUnit === 'Å'
    ? ladder?.polycrystalline
      ? '晶粒大小與方位為假想示意；晶格以下為真實比例。'
      : '巨觀外形為理想化示意；晶格以下為真實比例。'
    : '示意晶胞無真實尺寸，比例尺以 1 單位 = 1 Å 計算。',
)

/** 滾輪在尺度之旅中改為推進／後退放大（取代相機縮放）。 */
function onWheel(e: WheelEvent) {
  if (!ladderActive()) return
  e.preventDefault()
  ui.demoPlaying = false
  ui.demoOn = true
  const step = (e.deltaY / 1000) * (LADDER_DURATION / 8)
  ui.demoTime = Math.min(LADDER_DURATION, Math.max(0, ui.demoTime + step))
}

// ──────────────────────────────────────────────────────────────

function resetView() {
  if (ladderActive()) return
  const basis = structure.latticeBasis
  if (prismActive()) {
    const height = basis.c[2] * layers()
    renderer?.resetView([0, 0, height / 2], Math.hypot(2 * Math.hypot(...basis.a), height) * 0.7)
    return
  }
  const corner = fracToCart(basis, blockCorner(ui.viewMode))
  renderer?.resetView(fracToCart(basis, blockCorner(ui.viewMode).map((n) => n / 2) as Vec3), Math.hypot(...corner))
}

onMounted(() => {
  renderer = new CrystalRenderer(host.value!)
  document.fonts?.ready.then(() => (fontsReady.value = true))
  const sizeObserver = new ResizeObserver(() => (hostHeight.value = host.value?.clientHeight ?? 600))
  sizeObserver.observe(host.value!)
  host.value!.addEventListener('wheel', onWheel, { passive: false })

  // 於 renderer 建立後才開始追蹤；任何結構或顯示設定變動都會重建場景
  watchEffect(() => {
    void fontsReady.value
    if (!structure.cellValidation.valid) return
    if (ladderActive()) {
      ladder = buildLadder()
      renderer?.setLadder(ladder.stages)
      queueMicrotask(applyLadder)
      return
    }
    renderer?.update(buildScene())
    // 重建場景後套用目前的演示狀態；放進 microtask，讓時間不被此 effect 追蹤，避免每格重建場景
    if (demo.running.value) queueMicrotask(applyDemoState)
  })
  watch(
    () => [ui.demoTime, ui.assemblyMode, reducedMotion.value],
    () => (ladderActive() ? applyLadder() : demo.running.value && applyDemoState()),
  )
  // 離開尺度之旅：釋放各級場景並回到預設視角
  watch(ladderActive, (on) => {
    if (on) return
    ladder = null
    ladderHeightMetres.value = 0
    renderer?.setLadder(null)
    resetView()
  })

  // 演示播放完畢後開始自轉；重新演示、使用者操作相機或偏好減少動態效果時停止
  watch(
    () => demo.running.value,
    (running, wasRunning) => {
      if (running) ui.autoRotating = false
      else if (wasRunning && ui.autoRotatePref && !reducedMotion.value) ui.autoRotating = true
    },
  )
  watch(
    () => ui.autoRotatePref,
    (on) => (ui.autoRotating = on && !demo.running.value && !reducedMotion.value),
  )
  watch(reducedMotion, (reduce) => reduce && (ui.autoRotating = false))
  watch(
    () => ui.autoRotating,
    (on) => renderer?.setAutoRotate(on),
  )
  renderer.onUserInteract = () => (ui.autoRotating = false)
  watch(
    () => ui.autoRotateSeconds,
    (sec) => renderer?.setAutoRotateSeconds(sec),
    { immediate: true },
  )
  const r = structure.repeat
  watch(
    () => [ui.viewResetToken, structure.exampleId, ui.viewMode === 'motif', r.repeatA, r.repeatB, r.repeatC, prismActive()],
    resetView,
  )
  // 繞 c 軸旋轉只在六方柱模式有意義（旋轉中心為柱軸）；離開時歸零
  watch(prismActive, (on) => {
    if (!on) ui.cRotationSteps = 0
  })
  watch(
    () => ui.cRotationSteps,
    (n) => renderer?.rotateContentTo((n * Math.PI) / 3),
  )
  resetView()

  onBeforeUnmount(() => {
    sizeObserver.disconnect()
    host.value?.removeEventListener('wheel', onWheel)
  })
})

onBeforeUnmount(() => {
  renderer?.dispose()
  renderer = null
})
</script>

<template>
  <div ref="host" class="viewport" aria-label="3D 晶體模型檢視區">
    <!-- 尺度之旅的比例尺：長度隨放大連續變化，是整段動畫的教學核心 -->
    <Transition name="fade">
      <div v-if="scaleBarInfo" class="scalebar" aria-live="polite">
        <p class="eyebrow">尺度之旅 · {{ ladderCaption }}</p>
        <div class="bar-row">
          <span class="bar" :style="{ width: `${scaleBarInfo.widthPx}px` }" />
          <span class="bar-label">{{ scaleBarInfo.label }}</span>
        </div>
        <p class="fov">視野高度 ≈ {{ scaleBarInfo.height }}</p>
        <p class="caveat">{{ ladderCaveat }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
}
.viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.scalebar {
  --accent: var(--amber);
  position: absolute;
  left: 18px;
  bottom: 18px;
  max-width: min(360px, calc(100% - 36px));
  padding: 10px 14px 12px;
  border: 1px solid var(--border-strong);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-card);
  background: var(--surface);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 4px;
}
.bar {
  display: block;
  height: 6px;
  min-width: 4px;
  border: 1px solid var(--text);
  border-top: none;
  box-sizing: border-box;
}
.bar-label {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fov {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.caveat {
  margin: 6px 0 0;
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--muted);
}
.fade-enter-active {
  transition: opacity 200ms var(--ease-out);
}
.fade-leave-active {
  transition: opacity 120ms var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
