<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { directionVector, validateIndices } from '../core/direction'
import { planePolygon, validateMiller } from '../core/plane'
import { pieceCentroidAngle, pieceCount, pieceOutline, pieceSolid } from '../core/assembly'
import { demoState } from '../core/demo'
import { cellAngleMarks, formatDegrees } from '../core/angles'
import { cubeHabit, parallelepipedHabit, polyhedronExtent, type Polyhedron } from '../core/habit'
import { angleArc, hexagonalAxes, hexagonalHabit, hexPrismEdges } from '../core/hexagonal'
import { cellClipPlanes, fracToCart } from '../core/lattice'
import { findBonds } from '../core/neighbors'
import { LATTICE_POINT_ID, generateImages, generateLatticePoints, imageCellPosition } from '../core/periodic'
import { gridLayers, unitCellEdges } from '../core/grid'
import { downloadDataUrl, safeFilename } from '../services/fileIo'
import { centeringTranslations } from '../core/centering'
import { wrapPosition } from '../core/periodic'
import { BLOCK_CELLS, formatLength, ladderSeconds, ladderState, ROD_METRES_PER_UNIT, scaleBar, zoomAtTime, type LadderProfile } from '../core/scaleLadder'
import type { BasisAtom, AtomImage, RepeatSettings, Vec3 } from '../core/types'
import { elementStyle } from '../data/elements'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import type { LatticeSurfaceSpec } from '../render/latticeSurface'
import { useDemo } from '../composables/useDemo'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useI18n } from '../i18n'
import { bootFail, bootReady, bootReport } from '../boot/report'
import {
  CrystalRenderer,
  LADDER_VIEW_DIR,
  type AtomInfo,
  type LadderStageScene,
  type MacroObject,
  type PickResult,
  type SceneAtom,
  type SceneAxis,
  type SceneData,
  type SceneLabel,
  type ScenePiece,
  type ScenePlane,
} from '../render/CrystalRenderer'
import { useStructureStore } from '../stores/structure'
import { useUiStore, type ViewMode } from '../stores/ui'
import AtomCard from './AtomCard.vue'
import ViewCube from './ViewCube.vue'
import { MOBILE_QUERY, useMediaQuery } from '../composables/useMediaQuery'

const structure = useStructureStore()
const ui = useUiStore()
const host = ref<HTMLDivElement>()
let renderer: CrystalRenderer | null = null
/** 給視角方塊用的渲染器參考與重繪計數（每次主畫面重繪 +1）。 */
const rendererRef = shallowRef<CrystalRenderer | null>(null)
const renderTick = ref(0)
const isMobile = useMediaQuery(MOBILE_QUERY)

const LATTICE_POINT_COLOR = '#c9ced8'
const AXIS_COLORS = ['#d94848', '#3c9a4a', '#3b6fd1']
/** 四軸系統沿用常見教材配色：三個等價水平軸同色，c 軸另色。 */
const HEX_A_COLOR = '#e0458a'
const HEX_C_COLOR = '#c0392b'
const HABIT_COLOR = '#e3b23c'
/** 晶面截面的顏色（與晶向箭頭的琥珀色、晶軸的三色區分）。 */
const PLANE_COLOR = '#ff7eb6'
/** 夾角弧線與文字（與 120° 標示共用）。 */
const ANGLE_LINE_COLOR = '#5b6cf0'
const ANGLE_TEXT_COLOR = '#8f9cff'
/** 尺度之旅：金屬棒的顏色；單晶外形使用原子的平均色，與表面晶格的實心面一致。 */
const ROD_COLOR = '#9aa3ad'

const demo = useDemo()
const { t, l, term } = useI18n()
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
  const contact = ui.hardSphere && structure.hardSphereAllowed ? structure.nearestNeighbor / 2 : null
  const radiusOf = (element: string) =>
    contact ?? (element === 'X' ? 0.12 * minLen : elementStyle(element).displayRadius) * ui.sphereScale
  const latticePointRadius = 0.06 * minLen
  const kindColor = (img: AtomImage, fallback: string) => (ui.colorByKind ? LATTICE_POINT_KINDS[img.kind].color : fallback)

  const kindName = (img: AtomImage) => t(LATTICE_POINT_KINDS[img.kind].nameKey)
  const latticePointInfo = (img: AtomImage): AtomInfo => ({
    kind: 'latticePoint',
    element: '',
    elementZh: '',
    // 與原子一致：顯示晶胞內的位置（扣除晶胞偏移）
    frac: imageCellPosition(img),
    cellOffset: img.offset,
    globalFrac: img.fractionalPosition,
    pointKind: img.kind,
    isBoundaryImage: img.isBoundaryImage,
    motifIndex: 0,
    bondStatus: 'noRule',
    bondCount: 0,
    note: t('info.latticePointNote', {
      kind: kindName(img),
      lattice: t(structure.lattice.nameKey),
      symbol: structure.lattice.symbol,
      n: structure.basis.length,
    }),
  })
  const bondRules = structure.bondRules
  const atomInfo = (img: AtomImage, atom: BasisAtom): AtomInfo => {
    const index = structure.basis.findIndex((b) => b.id === atom.id) + 1
    const style = elementStyle(atom.element)
    const boundary = img.isBoundaryImage ? ` ${t('info.boundaryNote')}` : ''
    return {
      kind: 'atom',
      element: atom.element,
      elementZh: l(style.name),
      // FIX-01：數值一律取平移後的實際座標；基元符號式只作附註
      frac: imageCellPosition(img),
      basisFrac: atom.fractionalPosition,
      basisLabel: atom.positionLabel,
      cellOffset: img.offset,
      globalFrac: img.fractionalPosition,
      pointKind: img.kind,
      isBoundaryImage: img.isBoundaryImage,
      motifIndex: index,
      bondStatus: bondRules.length ? 'computed' : 'noRule',
      bondCount: 0,
      note: `${t('info.atomNote', { n: index, kind: kindName(img) })}${boundary}`,
    }
  }

  const latticePointAtom = (img: AtomImage, boundary = img.isBoundaryImage): SceneAtom => ({
    baseId: img.baseId,
    position: toCart(img.fractionalPosition),
    color: kindColor(img, LATTICE_POINT_COLOR),
    radius: latticePointRadius,
    isBoundaryImage: boundary,
    info: latticePointInfo(img),
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
    images = generateImages(structure.basis, repeat, structure.centering)
    latticePoints = generateLatticePoints(repeat, structure.centering)
  } else {
    images = prism ? structure.prismImages : clipping ? structure.imagesWithMargin : structure.images
    latticePoints = prism ? structure.prismLatticePoints : structure.latticePoints
  }

  if (viewMode === 'latticePoints') {
    atoms.push(...latticePoints.map((img) => latticePointAtom(img)))
  } else if (viewMode === 'motif') {
    // 一個晶格點（原點）＋與它關聯的基元原子，使用未折返的基元座標
    const origin: Vec3 = [0, 0, 0]
    const originImg: AtomImage = { baseId: LATTICE_POINT_ID, kind: 'corner', offset: [0, 0, 0], fractionalPosition: origin, latticePoint: origin, isBoundaryImage: false }
    atoms.push({ baseId: LATTICE_POINT_ID, position: origin, color: LATTICE_POINT_COLOR, radius: latticePointRadius, isBoundaryImage: false, info: latticePointInfo(originImg) })
    for (const atom of structure.basis) {
      const position = toCart(atom.fractionalPosition)
      const img: AtomImage = { baseId: atom.id, kind: 'corner', offset: [0, 0, 0], fractionalPosition: atom.fractionalPosition, latticePoint: origin, isBoundaryImage: false }
      const info = atomInfo(img, atom)
      info.note = t('info.motifNote', { n: info.motifIndex })
      atoms.push({ baseId: atom.id, position, color: elementStyle(atom.element).color, radius: radiusOf(atom.element), isBoundaryImage: false, info })
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
        info: atomInfo(img, atom),
      })
      bondCandidates.push({ element: atom.element, position })
      if (showAssociation) links.push([toCart(img.latticePoint), position])
    }
    if (showAssociation) atoms.push(...latticePoints.map((img) => latticePointAtom(img, false)))
  }

  // FIX-02：鄰近分析與是否繪製分離——資訊卡的連線數不隨「顯示連線」開關改變
  const bondPairs = findBonds(bondCandidates, bondRules)
  // 每顆原子的鍵數（bondCandidates 與 atoms 中的原子依序對應，晶格點不在其中）
  const atomsWithBonds = atoms.filter((a) => a.info?.kind === 'atom')
  for (const [i, j] of bondPairs) {
    if (atomsWithBonds[i]?.info) atomsWithBonds[i].info!.bondCount++
    if (atomsWithBonds[j]?.info) atomsWithBonds[j].info!.bondCount++
  }
  // 硬球接觸模型下球體相接，不另畫連線
  const drawBonds = ui.showBonds && !contact
  const bonds = drawBonds ? bondPairs.map(([i, j]) => [bondCandidates[i].position, bondCandidates[j].position] as [Vec3, Vec3]) : []

  let arrow: SceneData['arrow'] = null
  const d = structure.direction
  if (!over && structure.directionEnabled && validateIndices(d.u, d.v, d.w).valid) {
    const v = directionVector(basis, d.u, d.v, d.w)
    arrow = { origin: toCart(d.origin), vector: v.map((x) => x * d.displayLength) as Vec3 }
  }
  // 晶面：與展示區（或外擴一個晶胞）多面體的截面；視覺切面，不刪除原子
  const planes: ScenePlane[] = []
  const pl = structure.plane
  if (!over && !prism && structure.planeEnabled && validateMiller(pl.h, pl.k, pl.l).valid) {
    const margin = pl.clip ? 0 : 1
    const pts = planePolygon(basis, pl.h, pl.k, pl.l, pl.m, pl.shift, { min: [-margin, -margin, -margin], max: corner.map((n) => n + margin) as Vec3 })
    if (pts.length >= 3) planes.push({ points: pts, color: PLANE_COLOR, opacity: pl.opacity })
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
    ...edgeLayersOf(pieces !== null, prismEdges, repeat, toCartPair),
    secondaryEdges: [],
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
    planes,
    bonds,
    bondRadius: 0.02 * minLen,
    links,
    linkDash: 0.04 * minLen,
    clipPlanes: clipping ? cellClipPlanes(basis, corner) : null,
    showAxes,
  }
}

/** 三層格線：一般為 gridLayers；六方柱以外框為「超晶胞外框」、晶胞分隔線為「格線」；拼裝演示不畫。 */
function edgeLayersOf(
  pieces: boolean,
  prismEdges: ReturnType<typeof hexPrismEdges> | null,
  repeat: RepeatSettings,
  toCartPair: (p: [Vec3, Vec3]) => [Vec3, Vec3],
): Pick<SceneData, 'edgeLayers' | 'frameDuplicatesCell'> {
  if (pieces) return { edgeLayers: { cell: [], grid: [], frame: [] }, frameDuplicatesCell: false }
  if (prismEdges) {
    return {
      edgeLayers: { cell: unitCellEdges().map(toCartPair), grid: prismEdges.cellDividers.map(toCartPair), frame: prismEdges.outline.map(toCartPair) },
      frameDuplicatesCell: false,
    }
  }
  const g = gridLayers(repeat)
  return { edgeLayers: { cell: g.cell.map(toCartPair), grid: g.grid.map(toCartPair), frame: g.frame.map(toCartPair) }, frameDuplicatesCell: g.frameDuplicatesCell }
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

/** 金屬棒半徑 1 單位 = 1 cm；晶粒種子密度 200/單位 → 晶粒約 50 µm。 */
const ROD_RADIUS = 1
const ROD_LENGTH = 3
const GRAIN_SEEDS_PER_UNIT = 200
const MACRO_SIZE_METRES = 0.02
/** 尺度之旅的視角方向（俯角約 51°，與渲染層一致）。 */
const VIEW_DIR: Vec3 = (() => {
  const v = LADDER_VIEW_DIR
  const n = Math.hypot(...v)
  return [v[0] / n, v[1] / n, v[2] / n]
})()
/** 棒軸相對視線傾斜，起點時看得到側面，讀起來是「一根棒」而不是圓盤。 */
const ROD_AXIS: Vec3 = [VIEW_DIR[0] + 0.35, VIEW_DIR[1], VIEW_DIR[2] - 0.25]

interface LadderBuild {
  stages: LadderStageScene[]
  profile: LadderProfile
  /** 相機目標：晶格各級由表面晶胞的中心（start）移到該晶胞的原點晶格點（end）。 */
  targetStart: Vec3
  targetEnd: Vec3
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** 表面晶格的描述：晶胞內所有原子（含心型平移）、平均色作為實心面。 */
function buildSurfaceSpec(polycrystalline: boolean): LatticeSurfaceSpec {
  const basis = structure.latticeBasis
  const minLen = Math.min(structure.cell.a, structure.cell.b, structure.cell.c)
  const contact = ui.hardSphere && structure.hardSphereAllowed ? structure.nearestNeighbor / 2 : null
  const atoms: LatticeSurfaceSpec['atoms'] = []
  for (const atom of structure.basis) {
    const style = elementStyle(atom.element)
    const radius = contact ?? (atom.element === 'X' ? 0.12 * minLen : style.displayRadius) * ui.sphereScale
    for (const { vector: t } of centeringTranslations(structure.centering)) {
      const f = atom.fractionalPosition
      atoms.push({ frac: wrapPosition([f[0] + t[0], f[1] + t[1], f[2] + t[2]]), radius, color: hexToRgb(style.color) })
    }
  }
  const avg: [number, number, number] = [0, 0, 0]
  for (const a of atoms) for (let i = 0; i < 3; i++) avg[i] += a.color[i] / atoms.length
  const solidColor = polycrystalline ? ROD_COLOR : `#${avg.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
  return { basis, atoms, solidColor, solidLit: !polycrystalline }
}

/**
 * 巨觀單晶外形：頂面必須是晶格的 ab 面（表面晶格鋪在其上）。
 * 立方晶系用立方體（{100} 面），六方用六方柱（頂面 (0001)），其餘用與晶胞同形的平行六面體。
 * 回傳的 topCentre 為頂面中心（相機推進的目標）。
 */
function macroHabit(): Polyhedron & { topCentre: Vec3 } {
  const basis = structure.latticeBasis
  const system = structure.systemId
  if (system === 'hexagonal') {
    const h = hexagonalHabit(basis, 1)
    const top = Math.max(...h.vertices.map((v) => v[2]))
    // 六方柱＋雙錐：頂面取柱體的上底（錐尖以下）
    const ring = h.vertices.filter((v) => Math.abs(v[2] - basis.c[2] * 1 - Math.hypot(...basis.a) * 1.18 * 0.12) < 1e-6)
    const topZ = ring.length ? ring[0][2] : top
    return { ...h, topCentre: [0, 0, topZ] }
  }
  if (system === 'cubic') return { ...cubeHabit(2), topCentre: [0, 0, 1] }
  const raw = parallelepipedHabit(basis, 1)
  const scale = 2 / polyhedronExtent(raw)
  const p = parallelepipedHabit(basis, scale)
  const c = basis.c.map((v) => (v * scale) / 2) as Vec3
  return { ...p, topCentre: c }
}

function buildLadder(): LadderBuild {
  const basis = structure.latticeBasis
  const toCart = (f: Vec3) => fracToCart(basis, f)
  const polycrystalline = !!structure.source.polycrystalline

  const surface = buildSurfaceSpec(polycrystalline)
  let macro: MacroObject
  let macroOffset: Vec3 = [0, 0, 0]
  let macroMetresPerUnit: number
  if (polycrystalline) {
    macro = { kind: 'rod', radius: ROD_RADIUS, length: ROD_LENGTH, seedsPerUnit: GRAIN_SEEDS_PER_UNIT, axis: ROD_AXIS, color: ROD_COLOR }
    macroMetresPerUnit = ROD_METRES_PER_UNIT
  } else {
    const habit = macroHabit()
    // 外形顏色 = 表面晶格實心面的顏色（原子平均色），兩級交接時無縫
    macro = { kind: 'solid', polyhedron: habit, color: surface.solidColor }
    // 相機推向頂面（ab 面）的中心：表面晶格鋪在這個面上
    macroOffset = [-habit.topCentre[0], -habit.topCentre[1], -habit.topCentre[2]]
    macroMetresPerUnit = MACRO_SIZE_METRES / polyhedronExtent(habit)
  }

  /**
   * 晶格各級的座標約定：晶體表面為平面 z = 0，原點是表面上的一個晶格點；
   * 表面晶胞為分率 [0,1]×[0,1]×[−1,0]（頂面與表面齊平），其原點晶格點在 (0,0,−1)。
   */
  const half = Math.floor(BLOCK_CELLS / 2)
  const belowOne = toCart([0, 0, -1])
  const lattice = (viewMode: ViewMode, repeat: number, boundary: boolean, axes: boolean): SceneData =>
    buildScene({ viewMode, repeat: [repeat, repeat, repeat], boundaryImages: boundary, showAxes: axes, showAngles: axes })
  // 剖面的巨觀單位需與實際使用的物件一致（金屬棒 vs. 單晶外形）
  const profile = { ...demo.ladderProfile.value }
  profile.stages = profile.stages.map((st) => (st.id === 'macro' ? { ...st, metresPerUnit: macroMetresPerUnit } : st))

  return {
    stages: [
      { id: 'macro', macro, offset: macroOffset },
      { id: 'field', surface, offset: [0, 0, 0] },
      // 11³ 區塊：頂面與表面齊平，晶胞 [5,6]×[5,6]×[10,11] 對到表面晶胞
      { id: 'block', data: lattice('structure', BLOCK_CELLS, false, false), offset: toCart([-half, -half, -BLOCK_CELLS]) },
      { id: 'cell', data: lattice('structure', 1, true, true), offset: belowOne },
      // 基元級只保留晶胞邊線；座標軸與夾角由晶胞級負責並在此前淡出，避免兩級重疊時標籤疊加
      { id: 'motif', data: lattice('motif', 1, false, false), offset: belowOne },
    ],
    profile,
    targetStart: toCart([0.5, 0.5, -0.5]),
    targetEnd: belowOne,
  }
}

let ladder: LadderBuild | null = null
const ladderHeightMetres = ref(0)
const ladderStageId = ref<string>('macro')
const hostHeight = ref(600)

function applyLadder() {
  if (!ladder || !renderer) return
  const zoom = zoomAtTime(ladder.profile, ui.demoTime)
  const state = ladderState(ladder.profile, zoom, reducedMotion.value)
  const t = state.targetBlend
  const latticeTarget = ladder.targetStart.map((v, i) => v + (ladder!.targetEnd[i] - v) * t) as Vec3
  // 表面的實心面在區塊階段仍保留（周圍不會提早變黑），原子則依 field 的淡出
  const blockOpacity = state.stages.find((st) => st.id === 'block')?.opacity ?? 0
  const stages = state.stages.map((st) =>
    st.id === 'field' ? { ...st, atomOpacity: st.opacity, opacity: Math.max(st.opacity, blockOpacity) } : st,
  )
  renderer.setLadderView({ stages, latticeTarget })
  ladderHeightMetres.value = state.heightMetres
  // 說明文字取「最靠近原子尺度且已明顯可見」的一級
  ladderStageId.value = [...state.stages].reverse().find((s) => s.opacity >= 0.5)?.id ?? 'macro'
}

const stageName = (id: string) =>
  id === 'macro'
    ? t('ladder.stageMacro')
    : id === 'field'
      ? t('ladder.stageField')
      : id === 'block'
        ? t('ladder.stageBlock', { n: BLOCK_CELLS })
        : id === 'cell'
          ? t('ladder.stageCell')
          : t('ladder.stageMotif')
const scaleBarInfo = computed(() => {
  const h = ladderHeightMetres.value
  if (!h) return null
  const bar = scaleBar(h)
  return { label: formatLength(bar.metres), widthPx: bar.fraction * hostHeight.value, height: formatLength(h) }
})
// 說明文字依「目前範例」即時更新（不可讀取非響應式的 ladder 變數，否則切換範例後會顯示上一個範例的文字）
const polycrystalline = computed(() => !!structure.source.polycrystalline)
const ladderCaption = computed(() => {
  const stage = stageName(ladderStageId.value)
  if (ladderStageId.value !== 'macro') return stage
  return polycrystalline.value ? t('ladder.macroPoly', { stage }) : t('ladder.macroSingle', { stage })
})
const ladderCaveat = computed(() =>
  structure.source.lengthUnit === 'Å'
    ? polycrystalline.value
      ? t('ladder.caveatPoly')
      : t('ladder.caveatSingle')
    : t('ladder.caveatSchematic'),
)

// ───────────────────────── 原子懸停資訊卡 ─────────────────────────

const hovered = ref<PickResult | null>(null)
const hoverSide = ref<'right' | 'left'>('right')
const hoverColor = computed(() => hovered.value?.atom.color ?? '')
let hoverFrame = 0
let lastPointer: [number, number] | null = null
/**
 * 目前懸停的原子（非響應式）。比較與清除都用這個變數，不讀 hovered.value：
 * clearHover 會在重建場景的 watchEffect 內被呼叫，讀取 ref 會讓 effect 追蹤懸停狀態，
 * 導致每次懸停都觸發重建並立刻清除。
 */
let currentAtom: SceneAtom | null = null

function setHovered(hit: PickResult | null) {
  const atom = hit?.atom ?? null
  if (atom === currentAtom) {
    if (hit) hovered.value = hit
    return
  }
  currentAtom = atom
  renderer?.setHighlight(atom)
  hovered.value = hit
}

/** 指標移動：每格最多挑選一次（挑選需光線投射）。 */
function onPointerMove(e: PointerEvent) {
  // 觸控沒有懸停；聚焦中停靠卡已顯示資訊，不再疊懸停卡
  if (e.pointerType === 'touch' || renderer?.focused) return
  const rect = host.value!.getBoundingClientRect()
  lastPointer = [e.clientX - rect.left, e.clientY - rect.top]
  if (hoverFrame) return
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    if (!lastPointer) return
    const hit = renderer?.pick(lastPointer[0], lastPointer[1]) ?? null
    if (hit) hoverSide.value = hit.screen[0] > rect.width - 300 ? 'left' : 'right'
    host.value!.style.cursor = hit ? 'pointer' : ''
    setHovered(hit)
  })
}

// ── 輕點／點擊一顆原子 → 鏡頭推近、資訊卡停靠在底部；點空白處返回 ──

const focused = ref<PickResult | null>(null)
const focusColor = computed(() => focused.value?.atom.color ?? '')
let tapStart: { x: number; y: number; t: number } | null = null
/** 聚焦前是否正在自轉；返回時恢復。 */
let rotatingBeforeFocus = false

/** 以 capture 階段監聽：要在 OrbitControls 的 start（會把自轉關掉）之前記下是否正在自轉。 */
function onPointerDown(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0) return
  tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }
  if (!renderer?.focused) rotatingBeforeFocus = ui.autoRotating
}

/** 放開時才判斷是「點一下」還是拖曳／縮放（觸控：移動 < 10 px；滑鼠：< 6 px；皆 < 500 ms）。 */
function onPointerUp(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0 || !tapStart) return
  const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y)
  const elapsed = performance.now() - tapStart.t
  tapStart = null
  if (moved > (e.pointerType === 'touch' ? 10 : 6) || elapsed > 500) return
  const rect = host.value!.getBoundingClientRect()
  const hit = renderer?.pick(e.clientX - rect.left, e.clientY - rect.top) ?? null
  if (hit) focusAtom(hit)
  else if (renderer?.focused) unfocusAtom()
}

function focusAtom(hit: PickResult) {
  if (!renderer) return
  ui.autoRotating = false
  hovered.value = null
  currentAtom = hit.atom
  renderer.setHighlight(hit.atom)
  focused.value = hit
  // 設計模式：點選即選取該基底原子（週期複本編輯其基底，所有等價複本同步）
  if (structure.editable && hit.atom.info?.kind === 'atom') structure.selectedAtomId = hit.atom.baseId
  renderer.focusAtom(hit.atom, 0.3, reducedMotion.value)
}

function unfocusAtom() {
  if (!renderer) return
  focused.value = null
  currentAtom = null
  renderer.setHighlight(null)
  renderer.unfocus(reducedMotion.value)
  if (rotatingBeforeFocus && ui.autoRotatePref && !demo.running.value) ui.autoRotating = true
  rotatingBeforeFocus = false
}

/** 滑鼠離開畫布：收起懸停卡（觸控放開後也會發 pointerleave，不能因此清掉停靠卡）。 */
function onPointerLeave(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  clearHover()
}

/** 收起懸停卡（滑鼠離開、使用者開始拖曳相機）；聚焦中的停靠卡不受影響。 */
function clearHover() {
  lastPointer = null
  if (!currentAtom || renderer?.focused) return
  setHovered(null)
}

/** 場景重建：相機已重設、原子物件已換新，直接忘掉懸停與聚焦。 */
function clearPicked() {
  if (renderer?.focused) {
    renderer.clearFocus()
    focused.value = null
    rotatingBeforeFocus = false
  }
  clearHover()
}

/** 每次繪製後讓懸停卡跟著球體（自轉、旋轉時）；停靠卡不跟隨。 */
function followHovered() {
  if (!currentAtom || !renderer || renderer.focused) return
  hovered.value = renderer.projectAtom(currentAtom)
}

/** 滾輪在尺度之旅中改為推進／後退放大（取代相機縮放）。 */
function onWheel(e: WheelEvent) {
  if (!ladderActive()) return
  e.preventDefault()
  ui.demoPlaying = false
  ui.demoOn = true
  const total = ladderSeconds(demo.ladderProfile.value)
  const step = (e.deltaY / 1000) * (total / 8)
  ui.demoTime = Math.min(total, Math.max(0, ui.demoTime + step))
}

// ───────────────────────── PNG 匯出 ─────────────────────────

/** 以目前畫面輸出 PNG；附圖例時在下方加一條說明帶（名稱、晶胞參數與單位、來源、自訂標記、元素圖例）。 */
function exportPng(legend: boolean) {
  if (!renderer) return
  const shot = renderer.captureImage()
  const name = structure.workspace === 'design' ? (structure.draft?.title ?? t('panel.draftTitle')) : l(structure.source.name)
  const file = `${safeFilename(name)}.png`
  if (!legend) {
    downloadDataUrl(file, shot)
    return
  }
  const img = new Image()
  img.onload = () => {
    const scale = Math.max(1, Math.round(img.width / 640))
    const pad = 14 * scale
    const line = 20 * scale
    const css = getComputedStyle(document.documentElement)
    const font = getComputedStyle(document.body).fontFamily
    const unit = structure.source.lengthUnit === 'Å' ? ' Å' : ''
    const c = structure.cell
    const symbol = structure.representation === 'cellSites' ? 'P' : structure.lattice.symbol
    const lines = [
      `a = ${c.a}${unit}  b = ${c.b}${unit}  c = ${c.c}${unit}  α = ${c.alpha}°  β = ${c.beta}°  γ = ${c.gamma}°  ·  ${symbol}`,
      structure.workspace === 'design'
        ? `${t('panel.custom')}  ·  ${t('png.source', { name: l(structure.source.name) })}`
        : `${t('png.source', { name: `${l(structure.source.name)} · ${structure.source.nameEn}` })}${structure.source.reference ? `  ·  ${l(structure.source.reference)}` : ''}`,
    ]
    const elements = [...new Set(structure.basis.map((a) => a.element))]
    const band = pad * 2 + line * (2 + lines.length)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height + band
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = css.getPropertyValue('--bg').trim() || '#0a0d13'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    ctx.fillStyle = css.getPropertyValue('--text').trim() || '#eceef3'
    ctx.font = `800 ${15 * scale}px ${font}`
    let y = img.height + pad + 15 * scale
    ctx.fillText(`${name}  —  CrystalScope`, pad, y)
    ctx.font = `${12 * scale}px ${font}`
    ctx.fillStyle = css.getPropertyValue('--text-2').trim() || '#c3c8d4'
    for (const text of lines) {
      y += line
      ctx.fillText(text, pad, y)
    }
    y += line
    let x = pad
    for (const el of elements) {
      ctx.fillStyle = elementStyle(el).color
      ctx.beginPath()
      ctx.arc(x + 6 * scale, y - 4 * scale, 5 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = css.getPropertyValue('--text-2').trim() || '#c3c8d4'
      const label = `${el} ${l(elementStyle(el).name)}`
      ctx.fillText(label, x + 16 * scale, y)
      x += 16 * scale + ctx.measureText(label).width + 18 * scale
    }
    downloadDataUrl(file, canvas.toDataURL('image/png'))
  }
  img.src = shot
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

/** WebGL 上下文遺失後重建渲染器並重畫目前場景。 */
function rebuildRenderer() {
  renderer?.dispose()
  renderer = null
  rendererRef.value = null
  ui.contextLost = false
  try {
    renderer = createRenderer()
    rendererRef.value = renderer
    rendererGen.value++
    resetView()
  } catch {
    ui.contextLost = true
  }
}

const rendererGen = ref(0)

function createRenderer(): CrystalRenderer {
  const r = new CrystalRenderer(host.value!)
  r.onContextLost = () => (ui.contextLost = true)
  r.onContextRestored = () => (ui.contextLost = false)
  r.onRendered = () => {
    followHovered()
    renderTick.value++
  }
  r.onUserInteract = () => {
    ui.autoRotating = false
    clearHover()
  }
  r.onFirstFrame = bootReady
  return r
}

onMounted(() => {
  try {
    renderer = createRenderer()
    rendererRef.value = renderer
    bootReport('webgl')
  } catch (e) {
    bootFail('webgl', e instanceof Error ? e.message : undefined)
    ui.contextLost = true
    return
  }
  document.fonts?.ready.then(() => (fontsReady.value = true))
  // 開發模式：讓瀏覽器主控台／自動化測試能檢視渲染器狀態
  if (import.meta.env.DEV) (window as unknown as { __cs: unknown }).__cs = { get renderer() { return renderer }, ui }
  const sizeObserver = new ResizeObserver(() => (hostHeight.value = host.value?.clientHeight ?? 600))
  sizeObserver.observe(host.value!)
  host.value!.addEventListener('wheel', onWheel, { passive: false })
  host.value!.addEventListener('pointermove', onPointerMove)
  host.value!.addEventListener('pointerdown', onPointerDown, true)
  host.value!.addEventListener('pointerup', onPointerUp)
  host.value!.addEventListener('pointerleave', onPointerLeave)

  // 於 renderer 建立後才開始追蹤；任何結構或顯示設定變動都會重建場景
  watchEffect(() => {
    void fontsReady.value
    void rendererGen.value
    if (!structure.cellValidation.valid) return
    if (ladderActive()) {
      ladder = buildLadder()
      renderer?.setLadder(ladder.stages)
      queueMicrotask(applyLadder)
      return
    }
    clearPicked()
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
  // 外觀：只更新材質，不重建場景（故意不放進上面的 watchEffect）
  watch(
    () => ({
      atomOpacity: ui.atomOpacity,
      bondOpacity: ui.bondOpacity,
      edges: { cell: { ...ui.edgeCell }, grid: { ...ui.edgeGrid }, frame: { ...ui.edgeFrame } },
    }),
    (a) => renderer?.setAppearance(a),
    { immediate: true, deep: true },
  )
  watch(
    () => ui.pngRequest,
    (req) => req && exportPng(req.legend),
  )
  watch(
    () => ui.viewAlongRequest,
    (req) => req && renderer?.viewAlong(req.vector, reducedMotion.value),
  )
  watch(
    () => ui.projection,
    (mode) => renderer?.setProjection(mode),
    { immediate: true },
  )
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
    cancelAnimationFrame(hoverFrame)
    host.value?.removeEventListener('wheel', onWheel)
    host.value?.removeEventListener('pointermove', onPointerMove)
    host.value?.removeEventListener('pointerdown', onPointerDown, true)
    host.value?.removeEventListener('pointerup', onPointerUp)
    host.value?.removeEventListener('pointerleave', onPointerLeave)
  })
})

onBeforeUnmount(() => {
  renderer?.dispose()
  renderer = null
})
</script>

<template>
  <div ref="host" class="viewport" :aria-label="t('viewport.aria')">
    <!-- WebGL 上下文遺失／無法建立：不留空白，給使用者明確的出口 -->
    <div v-if="ui.contextLost" class="gl-lost" role="alert">
      <p class="gl-title">{{ t('error.contextLost') }}</p>
      <p class="gl-body">{{ t('error.contextLostBody') }}</p>
      <button class="primary" @click="rebuildRenderer">{{ t('error.rebuild') }}</button>
    </div>
    <AtomCard
      :info="hovered?.atom.info ?? null"
      :x="hovered?.screen[0] ?? 0"
      :y="hovered?.screen[1] ?? 0"
      :radius="hovered?.screenRadius ?? 0"
      :side="hoverSide"
      :color="hoverColor"
    />
    <!-- 視角方塊：桌面、非尺度之旅時 -->
    <ViewCube v-if="rendererRef && !isMobile && !ui.ladderOn && !ui.contextLost" :renderer="rendererRef" :tick="renderTick" @home="resetView" />
    <AtomCard :info="focused?.atom.info ?? null" docked :x="0" :y="0" :radius="0" side="right" :color="focusColor" @close="unfocusAtom" />
    <!-- 尺度之旅的比例尺：長度隨放大連續變化，是整段動畫的教學核心 -->
    <Transition name="fade">
      <div v-if="scaleBarInfo" class="scalebar" aria-live="polite">
        <p class="eyebrow">{{ term('scaleJourney') }} · {{ ladderCaption }}</p>
        <div class="bar-row">
          <span class="bar" :style="{ width: `${scaleBarInfo.widthPx}px` }" />
          <span class="bar-label">{{ scaleBarInfo.label }}</span>
        </div>
        <p class="fov">{{ t('ladder.fov', { h: scaleBarInfo.height }) }}</p>
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
.gl-lost {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
}
.gl-title {
  margin: 0;
  font-weight: 800;
  font-size: 1.05rem;
}
.gl-body {
  margin: 0 0 6px;
  max-width: 420px;
  color: var(--text-2);
  font-size: 0.9rem;
  line-height: 1.6;
}
.gl-lost button {
  justify-self: center;
}
.scalebar {
  --accent: var(--amber);
  position: absolute;
  left: 18px;
  bottom: 18px;
  /* 手機：避開左下角被拇指遮住的區域、字級略小 */
  font-size: 0.92em;
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
@media (max-width: 860px) {
  .scalebar {
    left: 10px;
    bottom: 10px;
    padding: 8px 10px 10px;
  }
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
