import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LatticeBasis, Vec3 } from '../core/types'

export interface SceneAtom {
  baseId: string
  position: Vec3
  color: string
  radius: number
  isBoundaryImage: boolean
}

export interface SceneArrow {
  origin: Vec3
  vector: Vec3
}

/** 渲染層只接收已換算好的直角座標，不做任何晶格計算。 */
export interface SceneData {
  basis: LatticeBasis
  atoms: SceneAtom[]
  cellEdges: [Vec3, Vec3][]
  /** 整個 Na×Nb×Nc 區塊的中心，用於置中相機目標。 */
  center: Vec3
  arrow: SceneArrow | null
  showAxes: boolean
  showCellEdges: boolean
}

const AXIS_COLORS = [0xd94848, 0x3c9a4a, 0x3b6fd1] as const

/**
 * Three.js 場景封裝。採按需重繪：只有相機或資料改變時才 render。
 * 由 Vue 元件建立與 dispose，不依賴 Vue。
 */
export class CrystalRenderer {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly content = new THREE.Group()
  private readonly resizeObserver: ResizeObserver
  private readonly sphere = new THREE.SphereGeometry(1, 32, 16)
  private frame = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000)
    // 晶體學慣例以 c 軸（z）朝上
    this.camera.up.set(0, 0, 1)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.addEventListener('change', () => this.requestRender())

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

    if (data.showCellEdges) this.content.add(this.buildEdges(data.cellEdges))
    if (data.showAxes) this.buildAxes(data.basis).forEach((o) => this.content.add(o))

    const solid = data.atoms.filter((a) => !a.isBoundaryImage)
    const ghost = data.atoms.filter((a) => a.isBoundaryImage)
    if (solid.length) this.content.add(this.buildAtoms(solid, 1))
    if (ghost.length) this.content.add(this.buildAtoms(ghost, 0.35))

    if (data.arrow) this.content.add(this.buildArrow(data.arrow))

    this.controls.target.set(...data.center)
    this.controls.update()
    this.requestRender()
  }

  /** 預設斜視角，距離依模型大小調整。 */
  resetView(center: Vec3, extent: number) {
    const dist = Math.max(extent, 1) * 2.6
    this.camera.position.set(center[0] + dist * 0.8, center[1] - dist, center[2] + dist * 0.6)
    this.controls.target.set(...center)
    this.controls.update()
    this.requestRender()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.clearContent()
    this.sphere.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private requestRender() {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.renderer.render(this.scene, this.camera)
    })
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  /** 移除並釋放上一次 update 建立的 GPU 資源（共用的球體幾何除外）。 */
  private clearContent() {
    this.content.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        // ArrowHelper 的幾何為 Three.js 內部共用，不可釋放
        if (obj.geometry !== this.sphere && !(obj.parent instanceof THREE.ArrowHelper)) obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m: THREE.Material) => m.dispose())
      }
    })
    this.content.clear()
  }

  private buildAtoms(atoms: SceneAtom[], opacity: number) {
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
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
    return mesh
  }

  /** 晶胞邊線刻意使用細、半透明線條，與化學鍵的視覺語意區分。 */
  private buildEdges(edges: [Vec3, Vec3][]) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(edges.flat(2), 3))
    const material = new THREE.LineBasicMaterial({ color: 0x7a8394, transparent: true, opacity: 0.7 })
    return new THREE.LineSegments(geometry, material)
  }

  private buildAxes(basis: LatticeBasis) {
    return [basis.a, basis.b, basis.c].map((v, i) => {
      const vec = new THREE.Vector3(...v)
      const len = vec.length()
      return new THREE.ArrowHelper(vec.normalize(), new THREE.Vector3(), len * 1.25, AXIS_COLORS[i], len * 0.08, len * 0.04)
    })
  }

  private buildArrow({ origin, vector }: SceneArrow) {
    const vec = new THREE.Vector3(...vector)
    const len = vec.length()
    return new THREE.ArrowHelper(vec.normalize(), new THREE.Vector3(...origin), len, 0xe0a020, len * 0.12, len * 0.06)
  }
}
