import * as THREE from 'three'
import type { Vec3 } from '../core/types'

/** 晶格表面的描述：基底（Å）、每個晶胞內的原子（含心型平移後）、實心面的顏色。 */
export interface LatticeSurfaceSpec {
  basis: { a: Vec3; b: Vec3; c: Vec3 }
  /** 分率座標 + 顯示半徑（Å），最多 MAX_ATOMS 個。 */
  atoms: { frac: Vec3; radius: number; color: [number, number, number] }[]
  /** 實心面的顏色（原子平均色或晶粒色）。 */
  solidColor: string
  /** 實心面是否受光（與巨觀物件一致：單晶外形受光、金屬棒切面不受光）。 */
  solidLit: boolean
}

export const MAX_ATOMS = 8
/** GPU 實例預算；每顆原子一個告示牌四邊形（2 個三角形）。 */
const INSTANCE_BUDGET = 1_200_000
/** 表面以下保留的晶胞層數；更深的原子被實心面遮住，不必產生。 */
const LAYERS = 2
/** 實心面的頂面位置（Å）：略低於表面原子中心，遮住更深的層；表面原子仍近乎完整。 */
const SOLID_TOP = -0.9
/** 實心面厚度（Å）：只需遮住下方，不必真的 2 cm 厚——巨大的座標會讓 float32 的頂面位置偏差達 ±1 Å。 */
const SOLID_THICKNESS = 4

const vertexShader = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform int uN;
  uniform int uM;
  uniform vec4 uAtoms[${MAX_ATOMS}];
  uniform vec3 uColors[${MAX_ATOMS}];
  uniform float uPxPerUnit;
  uniform float uOpacity;
  in vec2 corner;
  out vec2 vUv;
  out vec3 vColor;
  out float vAlpha;

  void main() {
    int id = gl_InstanceID;
    int m = id % uM;
    int rest = id / uM;
    int k = rest % ${LAYERS};
    rest /= ${LAYERS};
    int i = rest % uN;
    int j = rest / uN;
    float fi = float(i - uN / 2);
    float fj = float(j - uN / 2);
    float fk = -float(k);
    vec4 at = uAtoms[m];
    vec3 p = (fi + at.x) * uA + (fj + at.y) * uB + (fk + at.z) * uC;
    float r = at.w;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    // 投影半徑（像素）：小於約 1 像素時淡出，露出同色的實心面
    float px = r * uPxPerUnit / max(dist, 1e-6);
    float sizeFade = smoothstep(0.6, 2.5, px);
    // 視窗邊緣柔化，避免可見的方形邊界
    float edge = max(abs(fi), abs(fj)) / (float(uN) * 0.5);
    float edgeFade = 1.0 - smoothstep(0.75, 1.0, edge);
    // 表面以上的原子不存在（晶體在平面 z = 0 處終止）
    float below = p.z > 0.001 ? 0.0 : 1.0;
    vAlpha = sizeFade * edgeFade * below * uOpacity;

    mv.xy += corner * r;
    gl_Position = vAlpha > 0.01 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
    vUv = corner;
    vColor = uColors[m];
  }
`

const fragmentShader = /* glsl */ `
  in vec2 vUv;
  in vec3 vColor;
  in float vAlpha;
  out vec4 outColor;

  void main() {
    float d2 = dot(vUv, vUv);
    if (d2 > 1.0 || vAlpha < 0.01) discard;
    // 球面假體：由圓盤座標還原法向量做簡單打光
    vec3 n = vec3(vUv, sqrt(1.0 - d2));
    float light = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.5, 0.75))), 0.0);
    outColor = vec4(vColor * light, vAlpha);
  }
`

/**
 * GPU 產生的晶格表面：固定預算的實例，每一格依視野高度決定視窗大小（晶胞數），
 * 由 gl_InstanceID 直接算出各原子的晶格座標。遠處原子小於一像素時融入實心面。
 */
export class LatticeSurface {
  readonly group = new THREE.Group()
  private readonly material: THREE.ShaderMaterial
  private readonly geometry: THREE.InstancedBufferGeometry
  private readonly nMax: number
  private readonly perCell: number
  private readonly aMin: number
  private readonly solid: THREE.Mesh
  private readonly solidMaterial: THREE.Material

  constructor(spec: LatticeSurfaceSpec) {
    const atoms = spec.atoms.slice(0, MAX_ATOMS)
    this.perCell = atoms.length
    this.nMax = Math.max(4, Math.floor(Math.sqrt(INSTANCE_BUDGET / (LAYERS * this.perCell))))
    this.aMin = Math.min(Math.hypot(...spec.basis.a), Math.hypot(...spec.basis.b))

    const pad = <T>(list: T[], fill: T) => [...list, ...Array(MAX_ATOMS - list.length).fill(fill)]
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uA: { value: new THREE.Vector3(...spec.basis.a) },
        uB: { value: new THREE.Vector3(...spec.basis.b) },
        uC: { value: new THREE.Vector3(...spec.basis.c) },
        uN: { value: 4 },
        uM: { value: this.perCell },
        uAtoms: { value: pad(atoms.map((a) => new THREE.Vector4(...a.frac, a.radius)), new THREE.Vector4()) },
        uColors: { value: pad(atoms.map((a) => new THREE.Vector3(...a.color)), new THREE.Vector3()) },
        uPxPerUnit: { value: 1 },
        uOpacity: { value: 1 },
      },
    })

    this.geometry = new THREE.InstancedBufferGeometry()
    this.geometry.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2))
    this.geometry.setIndex([0, 1, 2, 0, 2, 3])
    this.geometry.instanceCount = 0
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12)
    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    mesh.renderOrder = 1

    // 實心面：單位大小的薄板，每格依視野縮放到剛好蓋住畫面（頂點座標保持小，頂面位置才精確）
    const solidGeometry = new THREE.BoxGeometry(2, 2, SOLID_THICKNESS)
    this.solidMaterial = spec.solidLit
      ? new THREE.MeshStandardMaterial({ color: spec.solidColor, roughness: 0.15, metalness: 0, flatShading: true })
      : new THREE.MeshBasicMaterial({ color: spec.solidColor })
    this.solid = new THREE.Mesh(solidGeometry, this.solidMaterial)
    this.solid.position.z = SOLID_TOP - SOLID_THICKNESS / 2
    this.solid.renderOrder = 0
    this.solid.frustumCulled = false
    // 由本類別自行釋放，渲染層的群組釋放略過這些物件
    mesh.userData.ownedBySurface = true
    this.solid.userData.ownedBySurface = true
    this.group.add(this.solid, mesh)
  }

  /**
   * 每次繪製前更新：視窗邊長取「3 × 視野高度」的晶胞數（上限為預算），
   * pxPerUnit = 畫面半高（像素）/ tan(fov/2)，供著色器換算投影半徑。
   */
  update(viewHeightUnits: number, pxPerUnit: number, atomOpacity: number, solidOpacity: number) {
    const n = Math.min(this.nMax, Math.max(6, Math.ceil((3 * viewHeightUnits) / this.aMin)))
    // 視窗為偶數，使中心落在晶胞角（晶格點）上
    const even = n % 2 === 0 ? n : n + 1
    this.material.uniforms.uN.value = even
    this.material.uniforms.uPxPerUnit.value = pxPerUnit
    this.material.uniforms.uOpacity.value = atomOpacity
    this.geometry.instanceCount = atomOpacity > 0.001 ? even * even * LAYERS * this.perCell : 0
    // 俯角 51°、fov 40° 時地面可見範圍不超過約 2.5 倍視野高度；取 4 倍保險
    const half = 4 * viewHeightUnits
    this.solid.scale.set(half, half, 1)
    this.solidMaterial.opacity = solidOpacity
    this.solidMaterial.transparent = solidOpacity < 0.999
    this.solidMaterial.depthWrite = solidOpacity >= 0.999
    this.solid.visible = solidOpacity > 0.001
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.solid.geometry.dispose()
    this.solidMaterial.dispose()
  }
}
