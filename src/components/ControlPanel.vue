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
import { useI18n } from '../i18n'

const structure = useStructureStore()
const ui = useUiStore()

const { t, l, term, termParts, locale } = useI18n()
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

const VIEW_MODES: { id: ViewMode; term: 'latticePoints' | 'motif' | 'structure' }[] = [
  { id: 'latticePoints', term: 'latticePoints' },
  { id: 'motif', term: 'motif' },
  { id: 'structure', term: 'structure' },
]

/** 目前晶格出現的晶格點類型（圖例只列出實際存在的類型）。 */
const legend = computed(() => {
  const kinds = new Set(centeringTranslations(structure.lattice.centering).map((t) => t.kind))
  return [...kinds].map((k) => ({ kind: k, ...LATTICE_POINT_KINDS[k] }))
})

const elements = computed(() => [...new Set(structure.basis.map((a) => a.element))].filter((e) => e !== 'X'))

const atomsPerCell = computed(() => structure.basis.length * latticePointsPerCell(structure.lattice.centering))

const bondRuleText = computed(() =>
  (structure.source.bonds ?? []).map((r) => `${r.elements.join('–')} ≤ ${r.maxDistance}${unit.value}`).join(', '),
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
  ui.viewMode === 'latticePoints' || structure.basis.length === 1 ? t('panel.rotNoteLattice') : t('panel.rotNoteStructure'),
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
  <aside class="control-panel" :aria-label="t('panel.aria')">
    <section class="hero">
      <p class="eyebrow">{{ structure.source.group === 'system' ? t('panel.heroSystem') : t('panel.heroMaterial') }}</p>
      <h2 class="hero-title">
        {{ structure.source.group === 'system' ? t('panel.systemTitle', { name: l(structure.source.name) }) : l(structure.source.name) }}
      </h2>
      <div class="hero-chips">
        <span class="chip">{{ structure.source.nameEn }}</span>
        <span class="chip symbol-chip">{{ structure.lattice.symbol }}</span>
      </div>
      <p v-if="structure.isCustom" class="badge">{{ t('panel.custom', { name: l(structure.source.name) }) }}</p>
      <dl class="meta">
        <dt>{{ t('panel.cellSetting') }}</dt>
        <dd>{{ l(structure.source.cellSetting) }}</dd>
        <dt>{{ t('panel.relations') }}</dt>
        <dd>{{ l(structure.source.relations) }}</dd>
      </dl>
      <p class="desc">{{ l(structure.source.description) }}</p>
      <p v-if="structure.source.reference" class="note">{{ l(structure.source.reference) }}</p>
    </section>

    <PanelCard data-tour="composition" :index="num('composition')" term="composition" icon="motif" accent="violet">
      <div class="segmented" role="group" :aria-label="t('panel.viewAria')">
        <button
          v-for="m in VIEW_MODES"
          :key="m.id"
          :aria-pressed="ui.viewMode === m.id"
          @click="ui.viewMode = m.id"
        >
          {{ termParts(m.term).label }}<span v-if="termParts(m.term).en" class="en-small">{{ termParts(m.term).en }}</span>
        </button>
      </div>
      <label v-if="ui.viewMode === 'structure'" class="check">
        <input v-model="ui.showAssociation" type="checkbox" /> {{ t('panel.association') }}
      </label>
      <MotifTable />
      <p class="note">{{ t('panel.perCell', { points: latticePointsPerCell(structure.lattice.centering), motif: structure.basis.length, atoms: atomsPerCell }) }}</p>
    </PanelCard>

    <PanelCard data-tour="lattice" :index="num('lattice')" term="bravais" icon="lattice" accent="mint">
      <div class="lattice-options" role="group" :aria-label="term('bravais')">
        <button
          v-for="lat in structure.source.lattices"
          :key="lat.symbol"
          :aria-pressed="structure.lattice.symbol === lat.symbol"
          :disabled="structure.source.lattices.length === 1"
          :title="lat.nameEn"
          @click="structure.setLattice(lat.symbol)"
        >
          {{ t(lat.nameKey) }} <span class="symbol">{{ lat.symbol }}</span>
        </button>
      </div>
      <label class="check"><input v-model="ui.colorByKind" type="checkbox" /> {{ t('panel.colorByKind') }}</label>
      <ul v-if="ui.colorByKind" class="legend">
        <li v-for="item in legend" :key="item.kind">
          <span class="swatch" :style="{ background: item.color }" />
          {{ t(item.nameKey) }} <span v-if="locale !== 'en'" class="en">{{ item.nameEn }}</span>
          <span class="pos">{{ item.position || t('kind.facePos') }}</span>
        </li>
      </ul>
      <ul v-else-if="elements.length" class="legend">
        <li v-for="el in elements" :key="el">
          <span class="swatch" :style="{ background: elementStyle(el).color }" />
          {{ el }} <span class="en">{{ l(elementStyle(el).name) }}</span>
        </li>
      </ul>
    </PanelCard>

    <PanelCard v-if="showHex" data-tour="hex" :index="num('hex')" term="hexagonal" icon="hex" accent="rose">
      <label class="check"><input v-model="ui.hexPrism" type="checkbox" /> {{ t('panel.hexPrism') }}</label>
      <label class="check" :class="{ disabled: !hexPrismOn }">
        <input v-model="ui.hexAxes" type="checkbox" :disabled="!hexPrismOn" /> {{ t('panel.hexAxes') }}
      </label>
      <label class="check" :class="{ disabled: !hexPrismOn }">
        <input v-model="ui.showHabit" type="checkbox" :disabled="!hexPrismOn" /> {{ t('panel.habit') }}
      </label>
      <p class="sub-label">{{ term('assembly') }}</p>
      <div class="segmented assembly-mode" role="group" :aria-label="t('panel.assemblyAria')">
        <button :aria-pressed="ui.assemblyMode === 'wedge6'" :disabled="!hexPrismOn" @click="setAssemblyMode('wedge6')">{{ t('panel.wedge6') }}</button>
        <button :aria-pressed="ui.assemblyMode === 'cell3'" :disabled="!hexPrismOn" @click="setAssemblyMode('cell3')">{{ t('panel.cell3') }}</button>
      </div>
      <p v-if="hexPrismOn" class="note">
        {{ ui.assemblyMode === 'wedge6' ? t('panel.assemblyNoteWedge') : t('panel.assemblyNoteCell') }}
        {{ t('panel.assemblyNoteTail') }}
      </p>
      <div class="rotate-row">
        <button :disabled="!hexPrismOn" @click="ui.cRotationSteps++">{{ t('panel.rotate60') }}</button>
        <button :disabled="!hexPrismOn || ui.cRotationSteps === 0" @click="ui.cRotationSteps = 0">{{ t('panel.rotateReset') }}</button>
        <output>{{ ui.cRotationSteps * 60 }}°</output>
      </div>
      <p class="note">{{ t('panel.hexAxesNote') }}</p>
      <p class="note">{{ rotationNote }}</p>
      <p v-if="ui.showHabit && hexPrismOn" class="note">{{ t('panel.habitNote') }}</p>
    </PanelCard>

    <PanelCard v-if="showParams" :index="num('params')" term="motifParams" icon="param" accent="sky">
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
        <p class="note full">{{ l(p.note) }}</p>
      </div>
    </PanelCard>

    <PanelCard data-tour="spheres" :index="num('spheres')" term="spheresBonds" icon="sphere" accent="amber">
      <label v-if="structure.source.hardSphere" class="check">
        <input v-model="ui.hardSphere" type="checkbox" /> {{ t('panel.hardSphere', { r: `${(structure.nearestNeighbor / 2).toFixed(3)}${unit}` }) }}
      </label>
      <div class="param-row">
        <label for="sphere-scale">{{ t('panel.size') }}</label>
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
        <input v-model="ui.showBonds" type="checkbox" /> {{ t('panel.bonds', { rules: bondRuleText }) }}
      </label>
      <label class="check" :class="{ disabled: ui.viewMode !== 'structure' }">
        <input v-model="ui.clipToCell" type="checkbox" :disabled="ui.viewMode !== 'structure'" /> {{ t('panel.clip') }}
      </label>
      <p class="note">{{ t('panel.sphereNote') }}</p>
    </PanelCard>

    <PanelCard :index="num('cell')" term="cellParams" icon="cell" accent="sky">
      <table class="params">
        <tr v-for="[k, v] in cellRows" :key="k">
          <th>{{ k }}</th>
          <td>{{ v }}</td>
        </tr>
      </table>
      <p class="todo">{{ t('panel.cellTodo') }}</p>
    </PanelCard>

    <PanelCard :index="num('repeat')" term="repeat" icon="repeat" accent="mint">
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

    <PanelCard :index="num('atom')" term="atomPosition" icon="atom" accent="violet">
      <p class="todo">{{ t('panel.atomTodo') }}</p>
    </PanelCard>

    <PanelCard :index="num('direction')" term="direction" icon="direction" accent="rose">
      <p class="todo">{{ t('panel.directionTodo') }}</p>
    </PanelCard>

    <PanelCard :index="num('display')" term="display" icon="display" accent="sky">
      <label class="check"><input v-model="ui.showCellEdges" type="checkbox" /> {{ t('panel.cellEdges') }}</label>
      <label class="check"><input v-model="ui.showAxes" type="checkbox" /> {{ t('panel.axes') }}</label>
      <label class="check" :class="{ disabled: !ui.showAxes }">
        <input v-model="ui.showAngles" type="checkbox" :disabled="!ui.showAxes" /> {{ t('panel.angles') }}
      </label>
      <label class="check"><input v-model="structure.repeat.showBoundaryImages" type="checkbox" /> {{ t('panel.boundary') }}</label>
      <div class="row-inline">
        <span>{{ t('panel.projection') }}</span>
        <div class="segmented" role="group" :aria-label="t('panel.projectionAria')">
          <button :aria-pressed="ui.projection === 'perspective'" :title="t('panel.perspectiveTitle')" @click="ui.projection = 'perspective'">{{ term('perspective') }}</button>
          <button :aria-pressed="ui.projection === 'orthographic'" :title="t('panel.orthographicTitle')" @click="ui.projection = 'orthographic'">{{ term('orthographic') }}</button>
        </div>
      </div>
      <p v-if="ui.projection === 'perspective'" class="note">{{ t('panel.perspectiveNote') }}</p>
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
/* 分段按鈕內的英文原文：另起一行、縮小，避免按鈕過寬換行 */
.en-small {
  display: block;
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1.1;
  opacity: 0.7;
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
.row-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 2px;
  font-size: 0.88rem;
  color: var(--text-2);
}
.todo {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
