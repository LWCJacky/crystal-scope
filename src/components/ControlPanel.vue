<script setup lang="ts">
import { computed } from 'vue'
import type { AssemblyMode } from '../core/assembly'
import { centeringTranslations, latticePointsPerCell } from '../core/centering'
import { elementStyle } from '../data/elements'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import { useStructureStore } from '../stores/structure'
import { useUiStore, type ViewMode } from '../stores/ui'
import { playDemo } from '../composables/useDemo'
import MotifTable from './MotifTable.vue'
import PanelCard from './PanelCard.vue'

const structure = useStructureStore()
const ui = useUiStore()

const unit = computed(() => (structure.source.lengthUnit === 'Å' ? ' Å' : ''))

const cellRows = computed(() => {
  const c = structure.cell
  return [
    ['a', `${c.a}${unit.value}`],
    ['b', `${c.b}${unit.value}`],
    ['c', `${c.c}${unit.value}`],
    ['α', `${c.alpha}°`],
    ['β', `${c.beta}°`],
    ['γ', `${c.gamma}°`],
  ]
})

const VIEW_MODES: { id: ViewMode; label: string; en: string }[] = [
  { id: 'latticePoints', label: '晶格點', en: 'Lattice' },
  { id: 'motif', label: '基元', en: 'Motif' },
  { id: 'structure', label: '結構', en: 'Structure' },
]

/** 目前晶格出現的晶格點類型（圖例只列出實際存在的類型）。 */
const legend = computed(() => {
  const kinds = new Set(centeringTranslations(structure.lattice.centering).map((t) => t.kind))
  return [...kinds].map((k) => ({ kind: k, ...LATTICE_POINT_KINDS[k] }))
})

const elements = computed(() => [...new Set(structure.basis.map((a) => a.element))].filter((e) => e !== 'X'))

const atomsPerCell = computed(() => structure.basis.length * latticePointsPerCell(structure.lattice.centering))

const bondRuleText = computed(() =>
  (structure.source.bonds ?? []).map((r) => `${r.elements.join('–')} ≤ ${r.maxDistance}${unit.value}`).join('、'),
)

const hexPrismOn = computed(() => ui.hexPrism && ui.viewMode !== 'motif')

const showHex = computed(() => structure.systemId === 'hexagonal')
const showParams = computed(() => !!structure.source.parameters?.length)

/** 模組編號依目前可見的卡片連續排序，隱藏的模組不佔號。 */
const MODULE_ORDER = ['composition', 'lattice', 'hex', 'params', 'spheres', 'cell', 'repeat', 'atom', 'direction', 'display'] as const
const visibleModules = computed(() =>
  MODULE_ORDER.filter((id) => (id === 'hex' ? showHex.value : id === 'params' ? showParams.value : true)),
)
const num = (id: (typeof MODULE_ORDER)[number]) => visibleModules.value.indexOf(id) + 1

/**
 * 旋轉對稱說明需依內容而定：六方晶格點具 6 次旋轉軸；
 * HCP、石墨（P6₃/mmc）繞柱軸純旋轉只有 3 次對稱，60° 需搭配沿 c 平移 c/2（6₃ 螺旋軸）。
 */
const rotationNote = computed(() =>
  ui.viewMode === 'latticePoints' || structure.basis.length === 1
    ? '晶格點繞 c 軸每轉 60° 即與原本重合，轉一圈重複 6 次（6 次旋轉軸）。'
    : '此結構繞柱軸純轉 60° 不會重合（中間層原子會落到空位），轉 120° 才重合；60° 需再沿 c 平移 c/2，即 6₃ 螺旋軸。切到「晶格點」視圖可看到晶格本身的 6 次對稱。',
)

/** 拖曳或按住方向鍵連續調整時，只在這一段操作開始時記錄一次復原快照。 */
const PARAM_COMMIT_GAP_MS = 600
let lastParamInput = 0
function onParamInput(key: string, value: number) {
  const now = performance.now()
  if (now - lastParamInput > PARAM_COMMIT_GAP_MS) structure.commit()
  lastParamInput = now
  structure.setParam(key, value)
}

function setAssemblyMode(mode: AssemblyMode) {
  ui.assemblyMode = mode
  playDemo()
}

const PRESETS = [1, 2, 3]
const AXES = [
  ['repeatA', 'Na'],
  ['repeatB', 'Nb'],
  ['repeatC', 'Nc'],
] as const
</script>

<template>
  <aside class="control-panel" aria-label="控制面板">
    <section class="hero">
      <p class="eyebrow">{{ structure.source.group === 'system' ? '晶系示意晶胞' : '晶體結構範例' }}</p>
      <h2 class="hero-title">
        {{ structure.source.nameZh }}{{ structure.source.group === 'system' ? '晶系' : '' }}
      </h2>
      <div class="hero-chips">
        <span class="chip">{{ structure.source.nameEn }}</span>
        <span class="chip symbol-chip">{{ structure.lattice.symbol }}</span>
      </div>
      <p v-if="structure.isCustom" class="badge">自訂結構（來源範例：{{ structure.source.nameZh }}）</p>
      <dl class="meta">
        <dt>晶胞設定</dt>
        <dd>{{ structure.source.cellSetting }}</dd>
        <dt>組成</dt>
        <dd>{{ structure.source.relations }}</dd>
      </dl>
      <p class="desc">{{ structure.source.description }}</p>
      <p v-if="structure.source.reference" class="note">{{ structure.source.reference }}</p>
    </section>

    <PanelCard data-tour="composition" :index="num('composition')" title="結構 = 晶格點 + 基元" en="Lattice + Motif" icon="motif" accent="violet">
      <div class="segmented" role="group" aria-label="檢視">
        <button
          v-for="m in VIEW_MODES"
          :key="m.id"
          :aria-pressed="ui.viewMode === m.id"
          :title="m.en"
          @click="ui.viewMode = m.id"
        >
          {{ m.label }}
        </button>
      </div>
      <label v-if="ui.viewMode === 'structure'" class="check">
        <input v-model="ui.showAssociation" type="checkbox" /> 疊加晶格點與關聯線（Association）
      </label>
      <MotifTable />
      <p class="note">每個慣用晶胞：{{ latticePointsPerCell(structure.lattice.centering) }} 個晶格點 × 基元 {{ structure.basis.length }} 個原子 = {{ atomsPerCell }} 個原子</p>
    </PanelCard>

    <PanelCard data-tour="lattice" :index="num('lattice')" title="布拉菲晶格" en="Bravais lattice" icon="lattice" accent="mint">
      <div class="lattice-options" role="group" aria-label="布拉菲晶格">
        <button
          v-for="l in structure.source.lattices"
          :key="l.symbol"
          :aria-pressed="structure.lattice.symbol === l.symbol"
          :disabled="structure.source.lattices.length === 1"
          :title="l.nameEn"
          @click="structure.setLattice(l.symbol)"
        >
          {{ l.nameZh }} <span class="symbol">{{ l.symbol }}</span>
        </button>
      </div>
      <label class="check"><input v-model="ui.colorByKind" type="checkbox" /> 依晶格點類型著色</label>
      <ul v-if="ui.colorByKind" class="legend">
        <li v-for="item in legend" :key="item.kind">
          <span class="swatch" :style="{ background: item.color }" />
          {{ item.nameZh }} <span class="en">{{ item.nameEn }}</span>
          <span class="pos">{{ item.position }}</span>
        </li>
      </ul>
      <ul v-else-if="elements.length" class="legend">
        <li v-for="el in elements" :key="el">
          <span class="swatch" :style="{ background: elementStyle(el).color }" />
          {{ el }} <span class="en">{{ elementStyle(el).nameZh }}</span>
        </li>
      </ul>
    </PanelCard>

    <PanelCard v-if="showHex" data-tour="hex" :index="num('hex')" title="六方晶系" en="Hexagonal" icon="hex" accent="rose">
      <label class="check"><input v-model="ui.hexPrism" type="checkbox" /> 六方柱（3 個晶胞組成，高度 = Nc 層）</label>
      <label class="check" :class="{ disabled: !hexPrismOn }">
        <input v-model="ui.hexAxes" type="checkbox" :disabled="!hexPrismOn" /> 四軸 a₁、a₂、a₃、c 與 120° 角
      </label>
      <label class="check" :class="{ disabled: !hexPrismOn }">
        <input v-model="ui.showHabit" type="checkbox" :disabled="!hexPrismOn" /> 晶體外形（六方柱＋雙錐）
      </label>
      <p class="sub-label">拼裝動畫 <span class="en">Assembly</span></p>
      <div class="segmented assembly-mode" role="group" aria-label="拼裝方式">
        <button :aria-pressed="ui.assemblyMode === 'wedge6'" :disabled="!hexPrismOn" @click="setAssemblyMode('wedge6')">6 塊三角柱</button>
        <button :aria-pressed="ui.assemblyMode === 'cell3'" :disabled="!hexPrismOn" @click="setAssemblyMode('cell3')">3 個晶胞</button>
      </div>
      <p v-if="hexPrismOn" class="note">
        {{
          ui.assemblyMode === 'wedge6'
            ? '每塊為六角形的 1/6（幾何切塊，不是晶胞；2 塊合成 1 個晶胞），依序繞 c 軸轉到 60° 間隔的位置。'
            : '每塊為一個六方晶胞（菱形底面、夾角 120°），3 個晶胞拼成一個六方柱。'
        }}
        先合併各塊的形狀，合併完成後再由下往上逐層顯示完整結構的原子。
      </p>
      <div class="rotate-row">
        <button :disabled="!hexPrismOn" @click="ui.cRotationSteps++">繞 c 軸旋轉 60°</button>
        <button :disabled="!hexPrismOn || ui.cRotationSteps === 0" @click="ui.cRotationSteps = 0">歸零</button>
        <output>{{ ui.cRotationSteps * 60 }}°</output>
      </div>
      <p class="note">
        a₁、a₂、a₃ 位於水平面、等長且互夾 120°，a₃ = −(a₁ + a₂)；c 軸垂直於此平面，是六方晶系的唯一軸。四指數晶向 [uvtw] 中 t = −(u + v)。
      </p>
      <p class="note">{{ rotationNote }}</p>
      <p v-if="ui.showHabit && hexPrismOn" class="note">
        外形為理想化幾何示意。常見的黃水晶（石英）外形接近六方柱，但石英實際屬於三方晶系。
      </p>
    </PanelCard>

    <PanelCard v-if="showParams" :index="num('params')" title="基元內部參數" en="Motif parameters" icon="param" accent="sky">
      <div v-for="p in structure.source.parameters" :key="p.key" class="param-row">
        <label :for="`param-${p.key}`"><i>{{ p.key }}</i></label>
        <input
          :id="`param-${p.key}`"
          type="range"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          :value="structure.params[p.key]"
          @input="onParamInput(p.key, +($event.target as HTMLInputElement).value)"
        />
        <output>{{ structure.params[p.key].toFixed(4) }}</output>
        <p class="note full">{{ p.note }}</p>
      </div>
    </PanelCard>

    <PanelCard data-tour="spheres" :index="num('spheres')" title="球體與鍵" en="Spheres &amp; bonds" icon="sphere" accent="amber">
      <label v-if="structure.source.hardSphere" class="check">
        <input v-model="ui.hardSphere" type="checkbox" /> 硬球接觸模型（r = 最近鄰距離 / 2 =
        {{ (structure.nearestNeighbor / 2).toFixed(3) }}{{ unit }}）
      </label>
      <div class="param-row">
        <label for="sphere-scale">大小</label>
        <input
          id="sphere-scale"
          v-model.number="ui.sphereScale"
          type="range"
          min="0.3"
          max="1.6"
          step="0.05"
          :disabled="ui.hardSphere && structure.source.hardSphere"
        />
        <output>{{ ui.sphereScale.toFixed(2) }}×</output>
      </div>
      <label v-if="structure.source.bonds?.length" class="check">
        <input v-model="ui.showBonds" type="checkbox" /> 鍵／最近鄰連線（{{ bondRuleText }}）
      </label>
      <label class="check" :class="{ disabled: ui.viewMode !== 'structure' }">
        <input v-model="ui.clipToCell" type="checkbox" :disabled="ui.viewMode !== 'structure'" /> 裁切至晶胞（看角落 ⅛、面上 ½）
      </label>
      <p class="note">球體大小為示意比例；硬球模型僅為幾何模型，不代表真實原子半徑。</p>
    </PanelCard>

    <PanelCard :index="num('cell')" title="晶胞參數" en="Cell parameters" icon="cell" accent="sky">
      <table class="params">
        <tr v-for="[k, v] in cellRows" :key="k">
          <th>{{ k }}</th>
          <td>{{ v }}</td>
        </tr>
      </table>
      <p class="todo">編輯與教學鎖定：M2</p>
    </PanelCard>

    <PanelCard :index="num('repeat')" title="週期排列" en="Repeat" icon="repeat" accent="mint">
      <div v-for="[key, label] in AXES" :key="key" class="repeat-row">
        <label :for="key">{{ label }}</label>
        <input
          :id="key"
          type="range"
          min="1"
          max="5"
          :value="structure.repeat[key]"
          @input="structure.setRepeat({ [key]: +($event.target as HTMLInputElement).value })"
        />
        <output>{{ structure.repeat[key] }}</output>
      </div>
      <div class="presets">
        <button
          v-for="n in PRESETS"
          :key="n"
          @click="structure.setRepeat({ repeatA: n, repeatB: n, repeatC: n })"
        >
          {{ n }}×{{ n }}×{{ n }}
        </button>
      </div>
    </PanelCard>

    <PanelCard :index="num('atom')" title="原子位置" en="Fractional x, y, z" icon="atom" accent="violet">
      <p class="todo">選取與編輯分率座標：M1</p>
    </PanelCard>

    <PanelCard :index="num('direction')" title="晶向" en="Direction [uvw]" icon="direction" accent="rose">
      <p class="todo">晶向箭頭與沿晶向觀看：M3</p>
    </PanelCard>

    <PanelCard :index="num('display')" title="顯示" en="Display" icon="display" accent="sky">
      <label class="check"><input v-model="ui.showCellEdges" type="checkbox" /> 晶胞邊線</label>
      <label class="check"><input v-model="ui.showAxes" type="checkbox" /> 晶格向量 a、b、c</label>
      <label class="check" :class="{ disabled: !ui.showAxes }">
        <input v-model="ui.showAngles" type="checkbox" :disabled="!ui.showAxes" /> 晶軸夾角 α、β、γ
      </label>
      <label class="check"><input v-model="structure.repeat.showBoundaryImages" type="checkbox" /> 邊界複本（淡色）</label>
    </PanelCard>
  </aside>
</template>

<style scoped>
/* 範例摘要：無左緣的頁首區，接著是各模組卡片 */
.hero {
  padding: 4px 2px 16px;
}
.hero-title {
  margin: 6px 0 8px;
  font-size: 1.35rem;
  line-height: 1.25;
}
.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.symbol-chip {
  font-style: italic;
  color: var(--accent);
  border-color: var(--tint-border);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.badge {
  display: inline-block;
  margin: 0 0 10px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 0.78rem;
  font-weight: 700;
}
.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0 0 10px;
  font-size: 0.84rem;
}
.meta dt {
  color: var(--muted);
}
.meta dd {
  margin: 0;
  color: var(--text-2);
}
.desc {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.75;
  color: var(--text-2);
}
.en {
  color: var(--muted);
  font-weight: 600;
  font-size: 0.75rem;
}
.segmented {
  margin-bottom: 8px;
}
.lattice-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.symbol {
  font-style: italic;
  opacity: 0.75;
}
.legend {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-2);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.pos {
  margin-left: auto;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.params {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}
.params th {
  text-align: left;
  padding: 3px 18px 3px 0;
  font-weight: 600;
  font-style: italic;
  color: var(--muted);
}
.repeat-row,
.param-row {
  display: grid;
  grid-template-columns: 2.5em 1fr 3.5em;
  align-items: center;
  gap: 10px;
  margin: 4px 0;
  font-size: 0.88rem;
}
.param-row output,
.repeat-row output {
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-weight: 700;
  color: var(--text);
}
.full {
  grid-column: 1 / -1;
  margin-top: 0;
}
.presets {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.sub-label {
  margin: 14px 0 6px;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-2);
}
.rotate-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 4px;
}
.rotate-row output {
  margin-left: auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.87rem;
  margin: 8px 0;
  line-height: 1.5;
  color: var(--text-2);
}
.check input {
  margin-top: 3px;
}
.check.disabled {
  opacity: 0.45;
}
.todo {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
