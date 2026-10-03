<script setup lang="ts">
import * as THREE from 'three'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import type { CrystalRenderer } from '../render/CrystalRenderer'
import type { Vec3 } from '../core/types'
import { useI18n } from '../i18n'

/**
 * 視角方塊（導覽小方塊）：跟著相機轉，顯示模型的 x／y／z 座標框；
 * 點面、稜、角把相機移到該方向（26 個方向），面對面時四周的箭頭各轉 90°。
 * 自己有一個 96 px 的小場景，只在主畫面重繪或懸停變化時重繪。
 */
const props = defineProps<{ renderer: CrystalRenderer; tick: number }>()
const { t } = useI18n()
const reduced = useReducedMotion()

const host = ref<HTMLDivElement>()
const SIZE = 96
const AXIS_COLORS = ['#d94848', '#3c9a4a', '#3b6fd1']
const AXIS_NAMES = ['x', 'y', 'z']
/** 稜／角的判定帶：面上座標絕對值超過此值視為靠近該邊。 */
const EDGE_ZONE = 0.3

let gl: THREE.WebGLRenderer | null = null
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 10)
camera.position.set(0, 0, 5)
const cube = new THREE.Group()
const faceMaterials: THREE.MeshStandardMaterial[] = []
const raycaster = new THREE.Raycaster()
let mesh: THREE.Mesh | null = null

/** 目前懸停的方向（content 座標的整數向量，例如 [1, 0, 1]）；null 為無。 */
const hovered = ref<Vec3 | null>(null)
const hoverLabel = computed(() => {
  const d = hovered.value
  if (!d) return ''
  const parts = d.map((v, i) => (v ? `${v > 0 ? '+' : '−'}${AXIS_NAMES[i]}` : '')).filter(Boolean)
  return t('viewcube.viewFrom', { dir: parts.join(' ') })
})

/** 面貼圖：256 px、縱向微漸層、細的軸色邊框、粗體字＋細陰影；高解析加 mipmap 與各向異性，縮小時不糊。 */
function faceTexture(axis: number, sign: number, highlight: boolean): THREE.CanvasTexture {
  const px = 256
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d')!
  const css = getComputedStyle(document.documentElement)
  const text = css.getPropertyValue('--text').trim() || '#eceef3'
  const accent = css.getPropertyValue('--violet').trim() || '#a596ff'
  const grad = ctx.createLinearGradient(0, 0, 0, px)
  grad.addColorStop(0, highlight ? '#514596' : '#353d52')
  grad.addColorStop(1, highlight ? '#3a3072' : '#242a3a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, px, px)
  // 邊框：該軸的顏色（a 紅、b 綠、c 藍），細、略內縮
  ctx.strokeStyle = AXIS_COLORS[axis]
  ctx.lineWidth = 12
  ctx.strokeRect(6, 6, px - 12, px - 12)
  ctx.globalAlpha = 1
  ctx.fillStyle = highlight ? '#ffffff' : text
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.font = `800 ${sign > 0 ? 112 : 96}px ${getComputedStyle(document.body).fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  void accent
  // BoxGeometry 各面的 UV 方向不同：旋轉文字，讓從外側看、世界 z 朝上（±z 面以 +y 朝上）時字是正的
  ctx.translate(px / 2, px / 2 + 2)
  ctx.rotate(FACE_TEXT_ROTATION[axis * 2 + (sign > 0 ? 0 : 1)])
  ctx.fillText(`${sign > 0 ? '' : '−'}${AXIS_NAMES[axis]}`, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = gl?.capabilities.getMaxAnisotropy() ?? 1
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

/** 各面文字的旋轉（弧度，canvas 座標）：依 BoxGeometry 的 UV 方向推得，順序 +x, −x, +y, −y, +z, −z。 */
const FACE_TEXT_ROTATION = [-Math.PI / 2, Math.PI / 2, Math.PI, 0, 0, 0]

/** BoxGeometry 的材質順序：+x, −x, +y, −y, +z, −z。 */
const FACE_ORDER: [number, number][] = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]

function buildCube() {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  for (const [axis, sign] of FACE_ORDER) faceMaterials.push(new THREE.MeshStandardMaterial({ map: faceTexture(axis, sign, false), roughness: 0.85, metalness: 0 }))
  mesh = new THREE.Mesh(geometry, faceMaterials)
  cube.add(mesh)
  // 深色稜線：讓三個面的交界清楚
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x0a0d13, transparent: true, opacity: 0.45 })))
  scene.add(cube)
  // 光照固定在小場景裡：方塊轉動時三個面明暗不同，才讀得出是立方體
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404a60, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(1.2, 1.6, 2.2)
  scene.add(key)
}

function setHighlight(dir: Vec3 | null) {
  FACE_ORDER.forEach(([axis, sign], i) => {
    const on = !!dir && Math.sign(dir[axis]) === sign
    const current = faceMaterials[i].userData.highlight === true
    if (on === current) return
    faceMaterials[i].map?.dispose()
    faceMaterials[i].map = faceTexture(axis, sign, on)
    faceMaterials[i].userData.highlight = on
    faceMaterials[i].needsUpdate = true
  })
}

function sync() {
  if (!gl) return
  const { camera: q, content } = props.renderer.getOrientation()
  // 模型座標 → 世界 → 相機座標：方塊呈現相機所見的模型座標框
  cube.quaternion.copy(q).invert().multiply(content)
  gl.render(scene, camera)
}

/** 由指標位置算出方向：命中的面必算，面上座標靠近邊緣的軸也算（稜／角）。 */
function pick(e: PointerEvent): Vec3 | null {
  if (!mesh || !host.value) return null
  const r = host.value.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * 2 - 1
  const y = -((e.clientY - r.top) / r.height) * 2 + 1
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
  const hit = raycaster.intersectObject(mesh, false)[0]
  if (!hit || !hit.face) return null
  const local = cube.worldToLocal(hit.point.clone())
  const n = hit.face.normal
  const dir: Vec3 = [0, 0, 0]
  const faceAxis = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].indexOf(1)
  const coords = [local.x, local.y, local.z]
  for (let k = 0; k < 3; k++) {
    if (k === faceAxis) dir[k] = Math.sign(coords[k]) || 1
    else if (Math.abs(coords[k]) > 0.5 - EDGE_ZONE) dir[k] = Math.sign(coords[k])
  }
  return dir
}

function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  const d = pick(e)
  const same = d && hovered.value && d.every((v, i) => v === hovered.value![i])
  if (same || (!d && !hovered.value)) return
  hovered.value = d
  setHighlight(d)
  sync()
}
function onLeave() {
  if (!hovered.value) return
  hovered.value = null
  setHighlight(null)
  sync()
}
function onClick(e: PointerEvent) {
  const d = pick(e)
  if (d) props.renderer.viewFrom(d, reduced.value)
}
const rotate = (axis: 'horizontal' | 'vertical', sign: 1 | -1) => props.renderer.rotateView(axis, sign, reduced.value)

onMounted(() => {
  gl = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 3))
  gl.setSize(SIZE, SIZE, false)
  gl.domElement.style.width = gl.domElement.style.height = `${SIZE}px`
  host.value!.appendChild(gl.domElement)
  buildCube()
  sync()
})
watch(() => props.tick, sync)
onBeforeUnmount(() => {
  faceMaterials.forEach((m) => {
    m.map?.dispose()
    m.dispose()
  })
  mesh?.geometry.dispose()
  gl?.dispose()
  gl = null
})
</script>

<template>
  <div class="viewcube" :aria-label="t('viewcube.aria')" role="group">
    <button class="arrow up" :title="t('viewcube.up')" :aria-label="t('viewcube.up')" @click="rotate('vertical', 1)">▲</button>
    <button class="arrow down" :title="t('viewcube.down')" :aria-label="t('viewcube.down')" @click="rotate('vertical', -1)">▼</button>
    <button class="arrow left" :title="t('viewcube.left')" :aria-label="t('viewcube.left')" @click="rotate('horizontal', -1)">◀</button>
    <button class="arrow right" :title="t('viewcube.right')" :aria-label="t('viewcube.right')" @click="rotate('horizontal', 1)">▶</button>
    <button class="arrow home" :title="t('viewcube.home')" :aria-label="t('viewcube.home')" @click="$emit('home')">⌂</button>
    <div ref="host" class="cube" :title="hoverLabel" @pointermove="onMove" @pointerleave="onLeave" @pointerup="onClick" />
    <span class="label" :class="{ on: hoverLabel }" aria-live="polite">{{ hoverLabel }}</span>
  </div>
</template>

<style scoped>
.viewcube {
  --accent: var(--violet);
  position: absolute;
  left: 14px;
  bottom: 14px;
  width: 140px;
  height: 140px;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.cube {
  width: 96px;
  height: 96px;
  pointer-events: auto;
  cursor: pointer;
  border-radius: 12px;
  transition: transform 160ms var(--ease-out);
}
.cube:active {
  transform: scale(0.97);
}
/* 箭頭：靠近時才出現，不佔畫面；只限滑鼠裝置 */
.arrow {
  position: absolute;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.68rem;
  line-height: 1;
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 160ms var(--ease-out),
    transform 120ms var(--ease-out),
    color 160ms ease;
}
.arrow.up {
  top: 0;
}
.arrow.down {
  bottom: 0;
}
.arrow.left {
  left: 0;
}
.arrow.right {
  right: 0;
}
.arrow.home {
  top: 0;
  right: 0;
  font-size: 0.8rem;
}
@media (hover: hover) and (pointer: fine) {
  .viewcube:hover .arrow,
  .viewcube:focus-within .arrow {
    opacity: 1;
    pointer-events: auto;
  }
  .arrow:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
}
.arrow:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
.arrow:active {
  transform: scale(0.94);
}
.label {
  position: absolute;
  left: 50%;
  top: -22px;
  transform: translateX(-50%) translateY(4px);
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border: 1px solid var(--border);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  opacity: 0;
  transition:
    opacity 120ms var(--ease-out),
    transform 120ms var(--ease-out);
}
.label.on {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .label,
  .label.on {
    transform: translateX(-50%);
  }
  .cube:active,
  .arrow:active {
    transform: none;
  }
}
</style>
