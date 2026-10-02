import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { easeInOut } from '../core/easing'
import type { Polyhedron } from '../core/habit'
import type { ClipPlane } from '../core/lattice'
import type { LatticePointKind } from '../core/centering'
import type { LadderStageId } from '../core/scaleLadder'
import type { Vec3 } from '../core/types'
import { createGrainMaterial } from './grainMaterial'
import { LatticeSurface, type LatticeSurfaceSpec } from './latticeSurface'

/** 懸停資訊卡的內容：由檢視區組裝，渲染層只負責挑選與投影。 */
/** 聚焦時球半徑佔視野半高的比例（球直徑約為畫面高度的 22%）。 */
const FOCUS_FRACTION = 0.16

export interface AtomInfo {
  kind: 'atom' | 'latticePoint'
  element: string
  elementZh: string
  /** 分率座標（含晶胞偏移前的基元座標）。 */
  frac: Vec3
  cellOffset: Vec3
  pointKind: LatticePointKind
  isBoundaryImage: boolean
  /** 基元中的序號（1 起）；晶格點為 0。 */
  motifIndex: number
  positionLabel?: string
  bondCount: number
  /** 依結構產生的一句說明。 */
  note: string
}

export interface SceneAtom {
  baseId: string
  position: Vec3
  color: string
  radius: number
  isBoundaryImage: boolean
  info?: AtomInfo
}

export interface PickResult {
  atom: SceneAtom
  /** 球心在畫面上的位置（相對於畫布左上角，CSS 像素）。 */
  screen: [number, number]
  /** 球在畫面上的半徑（CSS 像素），供資訊卡的引線避開球體。 */
  screenRadius: number
}

export interface SceneArrow {
  origin: Vec3
  vector: Vec3
}

/** 帶文字標籤的座標軸箭頭（a、b、c 或六方四軸 a₁、a₂、a₃、c）。 */
export interface SceneAxis extends SceneArrow {
  color: string
  label: string
}

export interface SceneLabel {
  text: string
  position: Vec3
  color: string
}

/** 實心多面體（例如晶體外形），以頂點與三角面描述。 */
export interface ScenePolyhedron {
  vertices: Vec3[]
  faces: [number, number, number][]
  edges: [Vec3, Vec3][]
  color: string
}

/** 拼裝動畫中的一塊：半透明實心柱體與外框，姿態由 setAssemblyPoses 逐格更新。 */
export interface ScenePiece {
  solid: { vertices: Vec3[]; faces: [number, number, number][] }
  edges: [Vec3, Vec3][]
  color: string
  /** 徑向飛入方向（弧度）。 */
  centroidAngle: number
}

export interface PieceTransform {
  angle: number
  radial: number
  opacity: number
}

/** 演示動畫某一時刻的不透明度與各塊姿態（對應 core/demo.ts 的 DemoState）。 */
export interface DemoOpacity {
  poses: PieceTransform[]
  atomLayers: number[]
  latticeLayers: number[]
  faces: number
  bonds: number
  edges: number
}

/** 渲染層只接收已換算好的直角座標，不做任何晶格計算。 */
export interface SceneData {
  axes: SceneAxis[]
  atoms: SceneAtom[]
  cellEdges: [Vec3, Vec3][]
  /** 次要邊線（例如六方柱內 3 個晶胞的分隔線），以虛線呈現。 */
  secondaryEdges: [Vec3, Vec3][]
  /** 折線（例如 120° 角弧）。 */
  polylines: { points: Vec3[]; color: string }[]
  labels: SceneLabel[]
  /** 文字標籤高度（場景單位）。 */
  labelSize: number
  polyhedron: ScenePolyhedron | null
  /** 演示模式：原子、晶格點、邊線、鍵改由 setDemoState 控制不透明度。 */
  demo: boolean
  /** 拼裝演示的各塊（僅 assembly）。 */
  pieces: ScenePiece[] | null
  /** 演示中的原子與晶格點，依高度分層（由下往上）。 */
  atomLayers: SceneAtom[][]
  latticeLayers: SceneAtom[][]
  /** 拼裝時徑向位移的最大距離（場景單位）。 */
  pieceOffset: number
  /** 整個 Na×Nb×Nc 區塊的中心，用於置中相機目標。 */
  center: Vec3
  arrow: SceneArrow | null
  /** 鍵／最近鄰連線（圓柱），與晶胞邊線的細線明確區分。 */
  bonds: [Vec3, Vec3][]
  bondRadius: number
  /** 晶格點 ↔ 基元原子的關聯虛線。 */
  links: [Vec3, Vec3][]
  /** 虛線段長，依晶胞大小調整。 */
  linkDash: number
  /** 非 null 時以這些平面裁切原子球體。 */
  clipPlanes: ClipPlane[] | null
  showAxes: boolean
  showCellEdges: boolean
}

const ROTATION_MS = 650

/** 尺度之旅的巨觀物件：切開的金屬棒（切面顯示晶粒）或單晶外形。 */
export type MacroObject =
  | { kind: 'rod'; radius: number; length: number; seedsPerUnit: number; axis: Vec3; color: string }
  | { kind: 'solid'; polyhedron: Polyhedron; color: string }

/** 尺度之旅的一級場景：一般場景資料、巨觀物件或 GPU 表面晶格，offset 讓各級的對齊點落在原點。 */
export interface LadderStageScene {
  id: LadderStageId
  data?: SceneData
  macro?: MacroObject
  surface?: LatticeSurfaceSpec
  offset: Vec3
}

export interface LadderView {
  /** atomOpacity：表面晶格的原子不透明度（實心面則用 opacity，可比原子晚淡出）。 */
  stages: { id: LadderStageId; opacity: number; viewHeightUnits: number; atomOpacity?: number }[]
  /** 晶格各級（block／cell／motif）共用的相機目標（場景單位）。 */
  latticeTarget: Vec3
}

const ORIGIN = new THREE.Vector3()
/** 尺度之旅的視角：俯角約 51°，從上方推向晶體表面，近處畫面不會被表面上的遠端邊緣佔據。 */
export const LADDER_VIEW_DIR: Vec3 = [0.5, -0.6, 1.0]

/**
 * Three.js 場景封裝。採按需重繪：只有相機或資料改變時才 render。
 * 由 Vue 元件建立與 dispose，不依賴 Vue。
 */
export class CrystalRenderer {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly ortho: THREE.OrthographicCamera
  /** 一般檢視使用的相機（透視或正交）；尺度之旅一律用透視相機。 */
  private active: THREE.Camera
  private readonly controls: OrbitControls
  private readonly content = new THREE.Group()
  private readonly resizeObserver: ResizeObserver
  private readonly sphere = new THREE.SphereGeometry(1, 32, 16)
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 12)
  private readonly disc = new THREE.CircleGeometry(1, 48)
  private frame = 0
  private rotationFrame = 0
  private autoRotateFrame = 0
  /** 使用者開始拖曳／縮放相機時呼叫（用於停止自轉）。 */
  onUserInteract: (() => void) | null = null
  /** 每次繪製完成後呼叫（懸停資訊卡用來跟著球體移動）。 */
  onRendered: (() => void) | null = null
  /** 第一幀繪製完成（只呼叫一次；啟動層據此結束）。 */
  onFirstFrame: (() => void) | null = null
  /** WebGL 上下文遺失／復原（弱顯卡、分頁長時間背景化時可能發生）。 */
  onContextLost: (() => void) | null = null
  onContextRestored: (() => void) | null = null
  private firstFrameDone = false
  private readonly raycaster = new THREE.Raycaster()
  private highlighted: { mesh: THREE.InstancedMesh; index: number; color: THREE.Color } | null = null
  /** 聚焦原子前的相機姿態；非 null 表示目前處於聚焦狀態。 */
  private savedPose: { position: THREE.Vector3; target: THREE.Vector3; zoom: number } | null = null
  private focusFrame = 0
  private pieceGroups: { group: THREE.Group; edge: THREE.Material; face: THREE.Material; centroidAngle: number }[] = []
  private atomLayerMaterials: THREE.Material[] = []
  private latticeLayerMaterials: THREE.Material[] = []
  private edgeMaterials: THREE.Material[] = []
  private pieceOffset = 0
  /** 拼裝完成才淡入的物件（例如跨塊的鍵）。 */
  private assemblyFinal: THREE.Material[] = []
  /** 尺度之旅：各級場景群組與目前的視圖；非 null 時以多次繪製取代一般繪製。 */
  private ladderGroups = new Map<LadderStageId, THREE.Group>()
  private ladderView: LadderView | null = null
  private ladderSurfaces = new Map<LadderStageId, LatticeSurface>()

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.localClippingEnabled = true
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      // 不 preventDefault 的話瀏覽器不會嘗試復原
      e.preventDefault()
      this.onContextLost?.()
    })
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.onContextRestored?.()
      this.requestRender()
    })

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000)
    // 晶體學慣例以 c 軸（z）朝上
    this.camera.up.set(0, 0, 1)
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000)
    this.ortho.up.set(0, 0, 1)
    this.active = this.camera
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.addEventListener('change', () => this.requestRender())
    this.controls.addEventListener('start', () => {
      // 使用者接手相機：中止聚焦補間
      cancelAnimationFrame(this.focusFrame)
      this.focusFrame = 0
      this.onUserInteract?.()
    })

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 2.2))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(3, -4, 6)
    this.scene.add(key)
    this.scene.add(this.content)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  update(data: SceneData) {
    this.clearContent()
    this.buildInto(this.content, data)
    this.controls.target.set(...data.center)
    this.controls.update()
    this.requestRender()
  }

  /** 依場景資料把物件建入指定群組（一般檢視用 content，尺度之旅各級各一組）。 */
  private buildInto(root: THREE.Group, data: SceneData) {
    if (data.showCellEdges) {
      const edges = [this.buildEdges(data.cellEdges)]
      if (data.secondaryEdges.length) edges.push(this.buildLinks(data.secondaryEdges, data.linkDash, 0x7a8394))
      for (const e of edges) {
        if (data.demo) this.edgeMaterials.push(e.material as THREE.Material)
        root.add(e)
      }
    }
    if (data.showAxes) {
      for (const axis of data.axes) {
        root.add(this.buildArrow(axis, axis.color, 0.025))
        const tip = axis.vector.map((v, i) => axis.origin[i] + v * 1.12) as Vec3
        root.add(this.buildLabel({ text: axis.label, position: tip, color: axis.color }, data.labelSize))
      }
    }
    // 夾角弧線與標籤屬於座標框架：演示時與晶胞邊線一起淡入
    const framing = [
      ...data.polylines.map((l) => this.buildPolyline(l.points, l.color)),
      ...data.labels.map((l) => this.buildLabel(l, data.labelSize * 0.42)),
    ]
    for (const obj of framing) {
      if (data.demo) {
        const m = obj.material as THREE.Material
        m.transparent = true
        m.userData.baseOpacity = 1
        this.edgeMaterials.push(m)
      }
      root.add(obj)
    }
    if (data.polyhedron) this.buildPolyhedron(data.polyhedron).forEach((o) => root.add(o))

    const planes = data.clipPlanes?.map((p) => new THREE.Plane(new THREE.Vector3(...p.normal), p.constant)) ?? null
    const solid = data.atoms.filter((a) => !a.isBoundaryImage)
    const ghost = data.atoms.filter((a) => a.isBoundaryImage)
    if (solid.length) root.add(this.buildAtoms(solid, 1, planes))
    if (ghost.length) root.add(this.buildAtoms(ghost, 0.35, planes))
    if (planes) this.buildCaps(solid, planes).forEach((m) => root.add(m))
    if (data.pieces) this.buildPieces(data.pieces, data.pieceOffset)
    const addLayers = (layers: SceneAtom[][], into: THREE.Material[]) =>
      layers.forEach((layer) => {
        const mesh = this.buildAtoms(layer, 1, null)
        const material = mesh.material as THREE.Material
        material.transparent = true
        material.userData.baseOpacity = layer[0]?.isBoundaryImage ? 0.35 : 1
        into.push(material)
        root.add(mesh)
      })
    addLayers(data.atomLayers, this.atomLayerMaterials)
    addLayers(data.latticeLayers, this.latticeLayerMaterials)
    if (data.bonds.length) {
      const bonds = this.buildBonds(data.bonds, data.bondRadius)
      if (data.demo) {
        const material = bonds.material as THREE.Material
        material.transparent = true
        this.assemblyFinal.push(material)
      }
      root.add(bonds)
    }
    if (data.links.length) root.add(this.buildLinks(data.links, data.linkDash))

    if (data.arrow) root.add(this.buildArrow(data.arrow, '#e0a020', 0.06))
  }

  /** 預設斜視角，距離依模型大小調整。 */
  resetView(center: Vec3, extent: number) {
    const dist = Math.max(extent, 1) * 2.6
    this.camera.position.set(center[0] + dist * 0.8, center[1] - dist, center[2] + dist * 0.6)
    this.controls.target.set(...center)
    if (this.active === this.ortho) this.orthoFromPerspective()
    this.controls.update()
    this.requestRender()
  }

  /**
   * 切換投影方式。透視 → 正交：以目前相機距離換算等效的視野高度；
   * 正交 → 透視：反向換算距離，兩者切換時畫面大小不變。
   */
  setProjection(mode: 'perspective' | 'orthographic') {
    const target = this.controls.target
    if (mode === 'orthographic' && this.active !== this.ortho) {
      this.orthoFromPerspective()
      this.active = this.ortho
    } else if (mode === 'perspective' && this.active !== this.camera) {
      const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
      const halfH = (this.ortho.top - this.ortho.bottom) / 2 / this.ortho.zoom
      const dir = this.ortho.position.clone().sub(target).normalize()
      this.camera.position.copy(target).addScaledVector(dir, halfH / halfTan)
      this.camera.lookAt(target)
      this.active = this.camera
    }
    if (!this.ladderView) {
      this.controls.object = this.active
      this.controls.update()
    }
    this.requestRender()
  }

  /** 讓正交相機與透視相機看到同樣大小的畫面（同方向、同視野高度）。 */
  private orthoFromPerspective() {
    const target = this.controls.target
    const dist = this.camera.position.distanceTo(target)
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    this.ortho.left = -halfH * this.camera.aspect
    this.ortho.right = halfH * this.camera.aspect
    this.ortho.top = halfH
    this.ortho.bottom = -halfH
    this.ortho.zoom = 1
    this.ortho.near = dist * 0.01
    this.ortho.far = dist * 100
    this.ortho.position.copy(this.camera.position)
    this.ortho.lookAt(target)
    this.ortho.updateProjectionMatrix()
  }

  /**
   * 將整個模型繞 z（c 軸）旋轉到指定角度，用於展示六次旋轉對稱。
   * 偏好減少動態效果時直接跳到終態。
   */
  rotateContentTo(angle: number) {
    cancelAnimationFrame(this.rotationFrame)
    const from = this.content.rotation.z
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || from === angle) {
      this.content.rotation.z = angle
      this.requestRender()
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ROTATION_MS)
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      this.content.rotation.z = from + (angle - from) * eased
      this.draw()
      if (t < 1) this.rotationFrame = requestAnimationFrame(step)
    }
    this.rotationFrame = requestAnimationFrame(step)
  }

  /** 套用演示狀態：拼裝各塊的姿態，以及各層原子、晶格點、邊線、鍵的不透明度。 */
  setDemoState({ poses, atomLayers, latticeLayers, faces, bonds, edges }: DemoOpacity) {
    this.pieceGroups.forEach(({ group, edge, face, centroidAngle }, k) => {
      const pose = poses[k]
      if (!pose) return
      const bearing = centroidAngle + pose.angle
      group.rotation.z = pose.angle
      group.position.set(Math.cos(bearing) * pose.radial * this.pieceOffset, Math.sin(bearing) * pose.radial * this.pieceOffset, 0)
      group.visible = pose.opacity > 0.001
      edge.opacity = pose.opacity * 0.95
      face.opacity = pose.opacity * faces * 0.32
      face.visible = face.opacity > 0.001
    })
    const fade = (m: THREE.Material, opacity: number) => {
      const base = m.userData.baseOpacity ?? 1
      m.opacity = opacity * base
      m.visible = opacity > 0.001
      // 完全不透明時寫入深度，避免透明排序問題
      m.depthWrite = opacity * base >= 0.999
    }
    this.atomLayerMaterials.forEach((m, i) => fade(m, atomLayers[i] ?? 1))
    this.latticeLayerMaterials.forEach((m, i) => fade(m, latticeLayers[i] ?? 1))
    this.assemblyFinal.forEach((m) => fade(m, bonds))
    // 邊線原本即半透明（0.7），保留其基準透明度
    this.edgeMaterials.forEach((m) => {
      m.opacity = edges * (m.userData.baseOpacity ?? 0.7)
      m.visible = edges > 0.001
    })
    this.requestRender()
  }

  /** 自轉速度：一圈所需秒數（OrbitControls 的 autoRotateSpeed 以 2.0 ≈ 30 秒一圈換算）。 */
  setAutoRotateSeconds(seconds: number) {
    // 不合法的值會讓相機座標變成 NaN、整個場景消失，因此直接忽略
    if (!Number.isFinite(seconds) || seconds <= 0) return
    this.controls.autoRotateSpeed = 60 / seconds
  }

  /** 相機繞 c 軸（z）等速自轉；需要連續重繪，因此只在開啟時執行迴圈。 */
  setAutoRotate(on: boolean) {
    cancelAnimationFrame(this.autoRotateFrame)
    this.controls.autoRotate = on
    if (!on) return
    let last = performance.now()
    const loop = (now: number) => {
      // 分頁切回時避免一次轉太多
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      this.controls.update(dt)
      this.autoRotateFrame = requestAnimationFrame(loop)
    }
    this.autoRotateFrame = requestAnimationFrame(loop)
  }

  private draw() {
    if (this.ladderView) this.renderLadder(this.ladderView)
    else this.renderer.render(this.scene, this.active)
    this.onRendered?.()
    if (!this.firstFrameDone) {
      this.firstFrameDone = true
      this.onFirstFrame?.()
    }
  }

  /**
   * 進入／離開尺度之旅。各級場景各自建成一個群組（含巨觀物件），
   * 相機固定看向原點、只允許旋轉；推進由 setLadderView 的視野高度決定。
   */
  setLadder(stages: LadderStageScene[] | null) {
    for (const g of this.ladderGroups.values()) {
      this.disposeGroup(g)
      this.scene.remove(g)
    }
    for (const sf of this.ladderSurfaces.values()) sf.dispose()
    this.ladderSurfaces.clear()
    this.ladderGroups.clear()
    this.ladderView = null
    const on = !!stages
    this.content.visible = !on
    this.controls.enableZoom = !on
    this.controls.enablePan = !on
    // 尺度之旅一律以透視相機繪製（各級依 fov 換算距離）；離開時還原一般檢視的相機
    this.controls.object = on ? this.camera : this.active
    if (!stages) {
      this.controls.update()
      this.requestRender()
      return
    }
    for (const stage of stages) {
      const g = new THREE.Group()
      g.position.set(...stage.offset)
      if (stage.macro) this.buildMacro(g, stage.macro)
      if (stage.surface) {
        const sf = new LatticeSurface(stage.surface)
        this.ladderSurfaces.set(stage.id, sf)
        g.add(sf.group)
      }
      if (stage.data) this.buildInto(g, stage.data)
      // 記錄每個材質的基準不透明度，供各級整體淡入淡出
      g.traverse((obj) => {
        for (const m of this.materialsOf(obj)) {
          m.userData.baseOpacity ??= m.opacity
          m.userData.baseDepthWrite ??= m.depthWrite
          // 文字貼圖等本來就透明的材質，淡入到 1 時仍須保持 transparent，否則貼圖的透明背景會變成黑框
          m.userData.baseTransparent ??= m.transparent
        }
      })
      g.visible = false
      this.scene.add(g)
      this.ladderGroups.set(stage.id, g)
    }
    // 相機只保留方向；距離由各級的視野高度在繪製時決定
    this.controls.target.copy(ORIGIN)
    this.camera.position.set(...LADDER_VIEW_DIR).normalize().multiplyScalar(10)
    this.controls.update()
  }

  setLadderView(view: LadderView) {
    this.ladderView = view
    this.requestRender()
  }

  /**
   * 尺度階梯繪製：每一可見級各自以「視野高度 / 2tan(fov/2)」的距離繪製一次，
   * 近／遠平面依距離設定，彼此之間清除深度，因此 10⁸ 倍的尺度差不會有浮點精度問題。
   */
  private renderLadder(view: LadderView) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    const savedPosition = this.camera.position.clone()
    const savedQuaternion = this.camera.quaternion.clone()
    const { near, far } = this.camera
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const target = new THREE.Vector3()

    this.renderer.autoClear = false
    this.renderer.clear()
    for (const g of this.ladderGroups.values()) g.visible = false
    for (const stage of view.stages) {
      const g = this.ladderGroups.get(stage.id)
      if (!g || stage.opacity <= 0.001) continue
      g.visible = true
      this.applyGroupOpacity(g, stage.opacity, stage.viewHeightUnits)
      if (stage.id === 'macro') target.copy(ORIGIN)
      else target.set(...view.latticeTarget)
      const dist = stage.viewHeightUnits / (2 * halfTan)
      // GPU 表面晶格：依視野決定視窗大小，並提供像素換算（畫面半高 / tan(fov/2)）
      this.ladderSurfaces
        .get(stage.id)
        ?.update(stage.viewHeightUnits, this.container.clientHeight / 2 / halfTan, stage.atomOpacity ?? stage.opacity, stage.opacity)
      this.camera.position.copy(target).addScaledVector(dir, dist)
      this.camera.lookAt(target)
      this.camera.near = dist * 0.02
      this.camera.far = dist * 60
      this.camera.updateProjectionMatrix()
      this.renderer.clearDepth()
      this.renderer.render(this.scene, this.camera)
      g.visible = false
    }
    this.renderer.autoClear = true
    this.camera.position.copy(savedPosition)
    this.camera.quaternion.copy(savedQuaternion)
    this.camera.near = near
    this.camera.far = far
    this.camera.updateProjectionMatrix()
  }

  private materialsOf(obj: THREE.Object3D): THREE.Material[] {
    const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!m) return []
    return Array.isArray(m) ? m : [m]
  }

  /** 整組淡入淡出：以基準不透明度乘上倍率；完全不透明時才寫入深度。 */
  private applyGroupOpacity(group: THREE.Group, opacity: number, viewHeightUnits: number) {
    group.traverse((obj) => {
      for (const m of this.materialsOf(obj)) {
        const o = (m.userData.baseOpacity ?? 1) * opacity
        if (m instanceof THREE.ShaderMaterial && m.uniforms.uOpacity) {
          // 表面晶格的材質由 LatticeSurface.update 自行設定
          if (m.uniforms.uN) continue
          m.uniforms.uOpacity.value = o
          if (m.uniforms.uViewHeight) m.uniforms.uViewHeight.value = viewHeightUnits
          continue
        }
        m.opacity = o
        m.transparent = o < 0.999 || m.userData.baseOpacity < 0.999 || m.userData.baseTransparent === true
        m.depthWrite = o >= 0.999 && (m.userData.baseDepthWrite ?? true)
      }
    })
  }

  /** 巨觀物件：切開的金屬棒（切面朝向預設視角，中心在原點）或單晶外形。 */
  private buildMacro(root: THREE.Group, macro: MacroObject) {
    if (macro.kind === 'solid') {
      this.buildPolyhedron({ ...macro.polyhedron, color: macro.color }, 0.92).forEach((o) => root.add(o))
      return
    }
    const geometry = new THREE.CylinderGeometry(macro.radius, macro.radius, macro.length, 64)
    const metal = new THREE.MeshStandardMaterial({ color: macro.color, metalness: 0.35, roughness: 0.45 })
    const grain = createGrainMaterial({ seedsPerUnit: macro.seedsPerUnit, baseColor: macro.color })
    // CylinderGeometry 的材質群組：0 側面、1 頂面（+y）、2 底面
    const mesh = new THREE.Mesh(geometry, [metal, grain, metal])
    const axis = new THREE.Vector3(...macro.axis).normalize()
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
    mesh.position.copy(axis).multiplyScalar(-macro.length / 2)
    root.add(mesh)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    cancelAnimationFrame(this.autoRotateFrame)
    cancelAnimationFrame(this.rotationFrame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.setLadder(null)
    this.clearContent()
    this.sphere.dispose()
    this.cylinder.dispose()
    this.disc.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private requestRender() {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.draw()
    })
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const halfH = (this.ortho.top - this.ortho.bottom) / 2
    this.ortho.left = -halfH * (w / h)
    this.ortho.right = halfH * (w / h)
    this.ortho.updateProjectionMatrix()
    this.requestRender()
  }

  /** 移除並釋放上一次 update 建立的 GPU 資源（共用的球體幾何除外）。 */
  private clearContent() {
    this.highlighted = null
    this.disposeGroup(this.content)
    this.pieceGroups = []
    this.atomLayerMaterials = []
    this.latticeLayerMaterials = []
    this.edgeMaterials = []
    this.assemblyFinal = []
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
      if (obj.userData.ownedBySurface) return
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose()
        obj.material.dispose()
      }
      // InstancedMesh 的 instanceMatrix／instanceColor 為獨立 GPU 緩衝，需經 dispose() 通知渲染器釋放
      if (obj instanceof THREE.InstancedMesh) obj.dispose()
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        // ArrowHelper 的幾何為 Three.js 內部共用，不可釋放
        const shared = obj.geometry === this.sphere || obj.geometry === this.cylinder || obj.geometry === this.disc
        if (!shared && !(obj.parent instanceof THREE.ArrowHelper)) obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m: THREE.Material) => m.dispose())
      }
    })
    group.clear()
  }

  private buildAtoms(atoms: SceneAtom[], opacity: number, clipPlanes: THREE.Plane[] | null) {
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      clippingPlanes: clipPlanes,
    })
    const mesh = new THREE.InstancedMesh(this.sphere, material, atoms.length)
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    atoms.forEach((atom, i) => {
      m.makeScale(atom.radius, atom.radius, atom.radius).setPosition(...atom.position)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, color.set(atom.color))
    })
    mesh.userData.baseIds = atoms.map((a) => a.baseId)
    mesh.userData.atoms = atoms
    return mesh
  }

  /** 以畫面座標（相對於畫布左上角）挑選最近的原子；尺度之旅期間不挑選。 */
  pick(x: number, y: number): PickResult | null {
    if (this.ladderView) return null
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return null
    this.raycaster.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), this.active)
    const meshes: THREE.InstancedMesh[] = []
    this.content.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.userData.atoms && o.visible) meshes.push(o)
    })
    const hit = this.raycaster.intersectObjects(meshes, false).find((i) => i.instanceId !== undefined)
    if (!hit) return null
    const mesh = hit.object as THREE.InstancedMesh
    const atom = (mesh.userData.atoms as SceneAtom[])[hit.instanceId!]
    return this.projectAtom(atom)
  }

  /** 把原子（content 座標）投影到畫面座標。 */
  projectAtom(atom: SceneAtom): PickResult {
    const { clientWidth: w, clientHeight: h } = this.container
    const centre = this.content.localToWorld(new THREE.Vector3(...atom.position))
    const projected = centre.clone().project(this.active)
    // 半徑：取球心沿相機右方位移 r 後的投影距離
    const right = new THREE.Vector3().setFromMatrixColumn(this.active.matrixWorld, 0).normalize()
    const edge = centre.clone().addScaledVector(right, atom.radius).project(this.active)
    const toPx = (v: THREE.Vector3): [number, number] => [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
    const c = toPx(projected)
    const e = toPx(edge)
    return { atom, screen: c, screenRadius: Math.hypot(e[0] - c[0], e[1] - c[1]) }
  }

  /** 目前是否聚焦在某顆原子上。 */
  get focused() {
    return this.savedPose !== null
  }

  /**
   * 鏡頭推進到一顆原子：視線方向不變（不失去方位感），目標點移到球心附近、
   * 距離縮到球佔視野高度約 FOCUS_FRACTION，並把球心放在畫面偏上 viewY（以視野半高為單位），
   * 留出下方給停靠的資訊卡。正交相機改 zoom 而不是距離。
   */
  focusAtom(atom: SceneAtom, viewY = 0.35, reduced = false) {
    if (this.ladderView) return
    if (!this.savedPose) {
      this.savedPose = { position: this.active.position.clone(), target: this.controls.target.clone(), zoom: this.ortho.zoom }
      // 近距離下文字標籤（軸名、夾角）會變得巨大並擋住原子，聚焦期間隱藏
      this.setLabelsVisible(false)
    }
    const centre = this.content.localToWorld(new THREE.Vector3(...atom.position))
    const dir = this.active.position.clone().sub(this.controls.target).normalize()
    const screenUp = new THREE.Vector3().setFromMatrixColumn(this.active.matrixWorld, 1).normalize()
    const halfH = atom.radius / FOCUS_FRACTION
    // 球心要在畫面上方 viewY·halfH 處 → 目標點放在球心下方
    const target = centre.clone().addScaledVector(screenUp, -viewY * halfH)
    let zoom = this.ortho.zoom
    let position: THREE.Vector3
    if (this.active === this.ortho) {
      position = target.clone().addScaledVector(dir, this.ortho.position.distanceTo(this.controls.target))
      zoom = this.ortho.top / halfH
    } else {
      position = target.clone().addScaledVector(dir, halfH / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
    }
    this.tweenCamera(position, target, zoom, reduced ? 0 : 650)
  }

  /** 回到聚焦前的視角。 */
  unfocus(reduced = false) {
    const pose = this.savedPose
    if (!pose) return
    this.savedPose = null
    this.setLabelsVisible(true)
    this.tweenCamera(pose.position, pose.target, pose.zoom, reduced ? 0 : 500)
  }

  /** 場景重建時直接忘掉聚焦（相機已由 update() 重設）。 */
  clearFocus() {
    this.savedPose = null
    cancelAnimationFrame(this.focusFrame)
    this.focusFrame = 0
  }

  private setLabelsVisible(visible: boolean) {
    this.content.traverse((o) => {
      if (o instanceof THREE.Sprite) o.visible = visible
    })
    this.requestRender()
  }

  /** 相機位置、目標（與正交 zoom）的補間：畫面上的移動用 ease-in-out。 */
  private tweenCamera(position: THREE.Vector3, target: THREE.Vector3, zoom: number, ms: number) {
    cancelAnimationFrame(this.focusFrame)
    this.focusFrame = 0
    const cam = this.active
    const p0 = cam.position.clone()
    const t0 = this.controls.target.clone()
    const z0 = this.ortho.zoom
    const apply = (k: number) => {
      cam.position.lerpVectors(p0, position, k)
      this.controls.target.lerpVectors(t0, target, k)
      if (cam === this.ortho) {
        this.ortho.zoom = z0 + (zoom - z0) * k
        this.ortho.updateProjectionMatrix()
      }
      this.controls.update()
      this.requestRender()
    }
    if (ms <= 0) {
      apply(1)
      return
    }
    const start = performance.now()
    const loop = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      apply(easeInOut(k))
      this.focusFrame = k < 1 ? requestAnimationFrame(loop) : 0
    }
    this.focusFrame = requestAnimationFrame(loop)
  }

  /** 高亮一顆原子（提亮其實例顏色）；傳 null 取消。 */
  setHighlight(atom: SceneAtom | null) {
    if (this.highlighted) {
      this.highlighted.mesh.setColorAt(this.highlighted.index, this.highlighted.color)
      this.highlighted.mesh.instanceColor!.needsUpdate = true
      this.highlighted = null
    }
    if (atom) {
      let found: { mesh: THREE.InstancedMesh; index: number } | null = null
      this.content.traverse((o) => {
        if (found || !(o instanceof THREE.InstancedMesh) || !o.userData.atoms) return
        const index = (o.userData.atoms as SceneAtom[]).indexOf(atom)
        if (index >= 0) found = { mesh: o, index }
      })
      if (found) {
        const { mesh, index } = found as { mesh: THREE.InstancedMesh; index: number }
        const color = new THREE.Color()
        mesh.getColorAt(index, color)
        this.highlighted = { mesh, index, color: color.clone() }
        mesh.setColorAt(index, color.lerp(new THREE.Color(0xffffff), 0.35))
        mesh.instanceColor!.needsUpdate = true
      }
    }
    this.requestRender()
  }

  /**
   * 為被晶胞面切開的球體補上實心截面：球心到平面的距離 s 小於半徑時，
   * 截面是半徑 √(r² − s²) 的圓盤。每個圓盤再以「其他」邊界面裁切，
   * 因此角落原子會得到三個 ¼ 圓、稜上原子兩個半圓、面上原子一個整圓。
   */
  private buildCaps(atoms: SceneAtom[], planes: THREE.Plane[]) {
    const meshes: THREE.InstancedMesh[] = []
    const zAxis = new THREE.Vector3(0, 0, 1)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const color = new THREE.Color()

    planes.forEach((plane, i) => {
      const cut = atoms
        .map((atom) => ({ atom, s: plane.distanceToPoint(new THREE.Vector3(...atom.position)) }))
        .filter(({ atom, s }) => Math.abs(s) < atom.radius - 1e-6)
      if (!cut.length) return

      const material = new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0,
        side: THREE.DoubleSide,
        clippingPlanes: planes.filter((_, j) => j !== i),
        // 截面略微前移，避免與晶胞邊線或相鄰截面深度衝突
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
      const mesh = new THREE.InstancedMesh(this.disc, material, cut.length)
      q.setFromUnitVectors(zAxis, plane.normal)
      cut.forEach(({ atom, s }, k) => {
        const center = new THREE.Vector3(...atom.position).addScaledVector(plane.normal, -s)
        const r = Math.sqrt(atom.radius * atom.radius - s * s)
        m.compose(center, q, new THREE.Vector3(r, r, 1))
        mesh.setMatrixAt(k, m)
        // 截面顏色略淡，與球面區分（如教科書的硬球切面圖）
        mesh.setColorAt(k, color.set(atom.color).lerp(new THREE.Color(0xffffff), 0.25))
      })
      meshes.push(mesh)
    })
    return meshes
  }

  private buildPieces(pieces: ScenePiece[], offset: number) {
    this.pieceOffset = offset
    for (const piece of pieces) {
      const group = new THREE.Group()
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(piece.solid.vertices.flat(), 3))
      geometry.setIndex(piece.solid.faces.flat())
      geometry.computeVertexNormals()
      const face = new THREE.MeshStandardMaterial({
        color: piece.color,
        transparent: true,
        roughness: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
        flatShading: true,
      })
      group.add(new THREE.Mesh(geometry, face))
      const edges = this.buildEdges(piece.edges, piece.color)
      const edge = edges.material as THREE.Material
      group.add(edges)
      this.pieceGroups.push({ group, edge, face, centroidAngle: piece.centroidAngle })
      this.content.add(group)
    }
  }

  private buildBonds(bonds: [Vec3, Vec3][], radius: number) {
    const material = new THREE.MeshStandardMaterial({ color: 0x9aa1ad, roughness: 0.6 })
    const mesh = new THREE.InstancedMesh(this.cylinder, material, bonds.length)
    const up = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    bonds.forEach(([p, r], i) => {
      const start = new THREE.Vector3(...p)
      const dir = new THREE.Vector3(...r).sub(start)
      const len = dir.length()
      q.setFromUnitVectors(up, dir.normalize())
      const mid = start.addScaledVector(dir, len / 2)
      m.compose(mid, q, new THREE.Vector3(radius, len, radius))
      mesh.setMatrixAt(i, m)
    })
    return mesh
  }

  private buildLinks(links: [Vec3, Vec3][], dash: number, color = 0xe0a020) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(links.flat(2), 3))
    const material = new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash * 0.7 })
    const lines = new THREE.LineSegments(geometry, material)
    lines.computeLineDistances()
    return lines
  }

  /** 晶胞邊線刻意使用細、半透明線條，與化學鍵的視覺語意區分。 */
  private buildEdges(edges: [Vec3, Vec3][], color: string | number = 0x7a8394) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(edges.flat(2), 3))
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
    return new THREE.LineSegments(geometry, material)
  }

  private buildArrow({ origin, vector }: SceneArrow, color: string, headRatio: number) {
    const vec = new THREE.Vector3(...vector)
    const len = vec.length()
    const head = Math.max(len * headRatio * 2, 0.08)
    return new THREE.ArrowHelper(vec.normalize(), new THREE.Vector3(...origin), len, color, head, head * 0.5)
  }

  private buildPolyline(points: Vec3[], color: string) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }))
  }

  /** 以 canvas 繪製的文字標籤，永遠面向相機且不被遮擋。 */
  private buildLabel({ text, position, color }: SceneLabel, size: number) {
    // 與介面相同的字體；網路字體尚未載入時退回系統襯線體（檢視區在 document.fonts.ready 後會重建）
    const font = 'italic 700 92px "Nunito Variable", "Noto Sans TC", "Times New Roman", serif'
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.font = font
    // 依文字寬度決定畫布大小，避免較長的標籤（如「γ 120°」）被截斷
    canvas.width = Math.max(128, Math.ceil(ctx.measureText(text).width) + 32)
    canvas.height = 128
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(20, 24, 32, 0.85)'
    ctx.strokeText(text, canvas.width / 2, 64)
    ctx.fillStyle = color
    ctx.fillText(text, canvas.width / 2, 64)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
    sprite.scale.set((size * canvas.width) / canvas.height, size, 1)
    sprite.position.set(...position)
    sprite.renderOrder = 10
    return sprite
  }

  /** 半透明實心多面體＋稜線，內部原子仍可看見。 */
  private buildPolyhedron({ vertices, faces, edges, color }: ScenePolyhedron, opacity = 0.28) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3))
    geometry.setIndex(faces.flat())
    geometry.computeVertexNormals()
    const solid = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        roughness: 0.15,
        metalness: 0,
        side: THREE.DoubleSide,
        // 近乎不透明的實心外形需寫入深度，否則內側面會透出
        depthWrite: opacity >= 0.9,
        flatShading: true,
      }),
    )
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edges.flat(2), 3)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    )
    return [solid, lines]
  }
}
