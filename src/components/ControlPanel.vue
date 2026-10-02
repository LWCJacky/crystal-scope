<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AssemblyMode } from '../core/assembly'
import { centeringTranslations, latticePointsPerCell } from '../core/centering'
import { constrainedKeys, GEOMETRY_CONSTRAINTS, type GeometryConstraint } from '../core/design'
import type { CellParams } from '../core/types'
import { ELEMENTS, elementStyle } from '../data/elements'
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

const CELL_KEYS: (keyof CellParams)[] = ['a', 'b', 'c', 'alpha', 'beta', 'gamma']
const CELL_LABEL: Record<keyof CellParams, string> = { a: 'a', b: 'b', c: 'c', alpha: 'α', beta: 'β', gamma: 'γ' }
const cellRows = computed(() => CELL_KEYS.map((k) => [CELL_LABEL[k], k.length === 1 ? `${structure.cell[k]}${unit.value}` : `${structure.cell[k]}°`]))

const VIEW_MODES: { id: ViewMode; term: 'latticePoints' | 'motif' | 'structure' }[] = [
  { id: 'latticePoints', term: 'latticePoints' },
  { id: 'motif', term: 'motif' },
  { id: 'structure', term: 'structure' },
]

/** 目前晶格出現的晶格點類型（圖例只列出實際存在的類型）。 */
const legend = computed(() => {
  const kinds = new Set(centeringTranslations(structure.centering).map((tr) => tr.kind))
  return [...kinds].map((k) => ({ kind: k, ...LATTICE_POINT_KINDS[k] }))
})

const elements = computed(() => [...new Set(structure.basis.map((a) => a.element))].filter((e) => e !== 'X'))
const atomsPerCell = computed(() => structure.basis.length * latticePointsPerCell(structure.centering))

const bondRuleText = computed(() => structure.bondRules.map((r) => `${r.elements.join('–')} ≤ ${r.maxDistance}${unit.value}`).join(', '))

const hexPrismOn = computed(() => ui.hexPrism && ui.viewMode !== 'motif')
const showHex = computed(() => structure.systemId === 'hexagonal')
/** FIX-03：六方柱生成器底面固定 3 個晶胞、只用 Nc，且不支援邊界複本與裁切；對應控制停用並說明。 */
const prismLocks = computed(() => showHex.value && hexPrismOn.value)
const design = computed(() => structure.workspace === 'design')
const showParams = computed(() => structure.parameters.length > 0)
const draftTitle = computed(() => structure.draft?.title ?? t('panel.draftTitle'))
const draftFrom = computed(() => {
  const p = structure.draft?.provenance
  if (!p) return ''
  const time = new Date(p.copiedAt).toLocaleString(locale.value === 'zh-TW' ? 'zh-TW' : locale.value, { hour12: false })
  return t('panel.draftFrom', { name: l(structure.source.name), time })
})

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

/** 連續操作（滑桿拖曳、輸入框編輯）以開始／結束事件合併為一筆歷史。 */
const tx = {
  // v-on 物件語法的鍵是事件名（不加 on）
  range: {
    pointerdown: () => structure.beginEdit(),
    pointerup: () => structure.endEdit(),
    keydown: () => structure.beginEdit(),
    keyup: () => structure.endEdit(),
    blur: () => structure.endEdit(),
  },
  field: { focus: () => structure.beginEdit(), blur: () => structure.endEdit() },
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

// ── 設計模式：晶胞編輯 ──
const cellDraft = ref<CellParams>({ ...structure.cell })
const cellError = ref<string | null>(null)
watch(
  () => structure.cell,
  (c) => {
    cellDraft.value = { ...c }
    cellError.value = null
  },
  { deep: true },
)
const lockedCellKeys = computed(() => new Set(constrainedKeys(structure.geometryConstraint)))
function applyCell(key: keyof CellParams, raw: string) {
  const value = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(value)) {
    cellError.value = t('panel.cellInvalid', { reason: t('panel.cellNaN') })
    return
  }
  const next = { ...cellDraft.value, [key]: value }
  const reason = structure.setCell(next)
  cellError.value = reason ? t('panel.cellInvalid', { reason }) : null
  // 未套用時保留使用者輸入，讓他看到被拒絕的值
  if (reason) cellDraft.value = next
}
function changeConstraint(value: string) {
  const reason = structure.setGeometryConstraint(value as GeometryConstraint)
  cellError.value = reason ? t('panel.cellInvalid', { reason }) : null
}

// ── 設計模式：原子編輯 ──
const ELEMENT_OPTIONS = Object.keys(ELEMENTS).filter((e) => e !== 'X')
const selected = computed(() => structure.selectedAtom)
const FRAC_KEYS = [0, 1, 2] as const
const FRAC_LABEL = ['x_f', 'y_f', 'z_f']
function applyFrac(axis: 0 | 1 | 2, raw: string, finalize: boolean) {
  const atom = selected.value
  const value = Number(raw)
  if (!atom || raw.trim() === '' || !Number.isFinite(value)) return
  const next = [...atom.fractionalPosition] as [number, number, number]
  next[axis] = value
  structure.setAtomPosition(atom.id, next, finalize)
}
function applyElement(raw: string) {
  if (selected.value) structure.setAtomElement(selected.value.id, raw)
}
const conflictText = computed(() =>
  structure.conflicts.map((c) => t(c.sameElement ? 'panel.conflictSame' : 'panel.conflictDiff', { a: c.a, b: c.b })),
)

// ── 設計模式：鄰近連線規則 ──
const newRule = ref({ a: '', b: '', d: 3 })
function addRule() {
  const a = newRule.value.a.trim() || elements.value[0] || 'X'
  const b = newRule.value.b.trim() || a
  if (!Number.isFinite(newRule.value.d) || newRule.value.d <= 0) return
  structure.addNeighborRule({ elements: [a, b], maxDistance: newRule.value.d })
  newRule.value = { a: '', b: '', d: 3 }
}
</script>

<template>
  <aside class="control-panel" :aria-label="t('panel.aria')">
    <!-- 設計模式：草稿是有效資料，來源說明只作追溯（FIX-04） -->
    <section v-if="design" class="hero">
      <p class="eyebrow">{{ t('panel.heroDraft') }}</p>
      <input
        class="title-input"
        type="text"
        :value="structure.draft?.title ?? ''"
        :placeholder="draftTitle"
        :aria-label="t('panel.draftTitleLabel')"
        @change="structure.setDraftTitle(($event.target as HTMLInputElement).value)"
      />
      <div class="hero-chips">
        <span class="chip symbol-chip">{{ structure.representation === 'cellSites' ? 'P' : structure.lattice.symbol }}</span>
        <span class="chip">{{ structure.representation === 'cellSites' ? t('panel.repCellSites') : t('panel.repMotif') }}</span>
      </div>
      <p class="badge">{{ t('panel.custom') }}</p>
      <p class="note">{{ structure.representation === 'cellSites' ? t('panel.repCellSitesNote') : t('panel.repMotifNote') }}</p>
      <button v-if="structure.representation === 'motif'" class="ghost small" :title="t('panel.convertNote')" @click="structure.convertToCellSites()">
        {{ t('panel.convertToCellSites') }}
      </button>
      <p v-if="draftFrom" class="note">{{ draftFrom }}</p>
      <details class="source-ref">
        <summary>{{ t('panel.sourceRef') }}</summary>
        <p class="note">{{ t('panel.sourceRefNote') }}</p>
        <dl class="meta">
          <dt>{{ t('panel.sourceName') }}</dt>
          <dd>{{ l(structure.source.name) }} · {{ structure.source.nameEn }}</dd>
          <dt>{{ t('panel.cellSetting') }}</dt>
          <dd>{{ l(structure.source.cellSetting) }}</dd>
          <dt>{{ t('panel.relations') }}</dt>
          <dd>{{ l(structure.source.relations) }}</dd>
        </dl>
        <p class="desc">{{ l(structure.source.description) }}</p>
        <p v-if="structure.source.reference" class="note">{{ l(structure.source.reference) }}</p>
      </details>
    </section>
    <!-- 教學模式：正式範例，唯讀 -->
    <section v-else class="hero">
      <p class="eyebrow">{{ structure.source.group === 'system' ? t('panel.heroSystem') : t('panel.heroMaterial') }}</p>
      <h2 class="hero-title">
        {{ structure.source.group === 'system' ? t('panel.systemTitle', { name: l(structure.source.name) }) : l(structure.source.name) }}
      </h2>
      <div class="hero-chips">
        <span class="chip">{{ structure.source.nameEn }}</span>
        <span class="chip symbol-chip">{{ structure.lattice.symbol }}</span>
      </div>
      <dl class="meta">
        <dt>{{ t('panel.cellSetting') }}</dt>
        <dd>{{ l(structure.source.cellSetting) }}</dd>
        <dt>{{ t('panel.relations') }}</dt>
        <dd>{{ l(structure.source.relations) }}</dd>
      </dl>
      <p class="desc">{{ l(structure.source.description) }}</p>
      <p v-if="structure.source.reference" class="note">{{ l(structure.source.reference) }}</p>
      <div class="copy-row">
        <button class="copy-btn" :title="t('panel.copyToDesignTitle')" @click="structure.copyToDesign()">{{ t('panel.copyToDesign') }}</button>
        <button class="ghost small" :title="t('panel.repMotifNote')" @click="structure.copyToDesign(structure.exampleId, 'motif')">{{ t('panel.copyMotif') }}</button>
      </div>
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
      <p v-if="structure.representation === 'cellSites'" class="note">{{ t('panel.perCellSites', { atoms: structure.basis.length }) }}</p>
      <p v-else class="note">{{ t('panel.perCell', { points: latticePointsPerCell(structure.centering), motif: structure.basis.length, atoms: atomsPerCell }) }}</p>
    </PanelCard>

    <PanelCard data-tour="lattice" :index="num('lattice')" term="bravais" icon="lattice" accent="mint">
      <div class="lattice-options" role="group" :aria-label="term('bravais')">
        <button
          v-for="lat in structure.source.lattices"
          :key="lat.symbol"
          :aria-pressed="structure.representation === 'cellSites' ? lat.centering === 'P' : structure.lattice.symbol === lat.symbol"
          :disabled="structure.source.lattices.length === 1 || structure.representation === 'cellSites'"
          :title="lat.nameEn"
          @click="structure.setLattice(lat.symbol)"
        >
          {{ t(lat.nameKey) }} <span class="symbol">{{ lat.symbol }}</span>
        </button>
      </div>
      <p v-if="structure.representation === 'cellSites'" class="note">{{ t('panel.latticeLocked') }}</p>
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
      <div v-for="p in structure.parameters" :key="p.key" class="param-row">
        <label :for="`param-${p.key}`"><i>{{ p.key }}</i></label>
        <!-- 教學模式唯讀：只顯示參考值；要拖動請複製到設計模式（基元表示） -->
        <input
          v-if="design"
          :id="`param-${p.key}`"
          type="range"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          :value="structure.params[p.key]"
          v-on="tx.range"
          @input="structure.setParam(p.key, +($event.target as HTMLInputElement).value)"
        />
        <span v-else :id="`param-${p.key}`" class="param-ref">{{ t('panel.paramRef', { value: p.default.toFixed(4) }) }}</span>
        <output>{{ structure.params[p.key].toFixed(4) }}</output>
        <p class="note full">{{ l(p.note) }}</p>
      </div>
      <p v-if="!design" class="note">{{ t('panel.readonly') }}</p>
    </PanelCard>

    <PanelCard data-tour="spheres" :index="num('spheres')" term="spheresBonds" icon="sphere" accent="amber">
      <label v-if="structure.hardSphereAllowed" class="check">
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
          :disabled="ui.hardSphere && structure.hardSphereAllowed"
        />
        <output>{{ ui.sphereScale.toFixed(2) }}×</output>
      </div>
      <label v-if="structure.bondRules.length" class="check">
        <input v-model="ui.showBonds" type="checkbox" /> {{ t('panel.bonds', { rules: bondRuleText }) }}
      </label>
      <!-- 設計模式：自訂元素對與距離門檻（只表示距離，不代表化學鍵） -->
      <template v-if="design">
        <p class="sub-label">{{ t('panel.rules') }}</p>
        <p class="note">{{ t('panel.rulesNote') }}</p>
        <div v-for="(rule, i) in structure.neighborRules" :key="i" class="rule-row">
          <input
            :value="rule.elements[0]"
            list="cs-elements"
            :aria-label="t('panel.element')"
            @change="structure.setNeighborRule(i, { elements: [($event.target as HTMLInputElement).value, rule.elements[1]], maxDistance: rule.maxDistance })"
          />
          <span>–</span>
          <input
            :value="rule.elements[1]"
            list="cs-elements"
            :aria-label="t('panel.element')"
            @change="structure.setNeighborRule(i, { elements: [rule.elements[0], ($event.target as HTMLInputElement).value], maxDistance: rule.maxDistance })"
          />
          <span>≤</span>
          <input
            :value="rule.maxDistance"
            type="number"
            min="0.01"
            step="0.05"
            :aria-label="t('panel.ruleMax')"
            @change="structure.setNeighborRule(i, { elements: rule.elements, maxDistance: +($event.target as HTMLInputElement).value })"
          />
          <button class="ghost small" :aria-label="t('panel.removeRule')" @click="structure.removeNeighborRule(i)">✕</button>
        </div>
        <div class="rule-row">
          <input v-model="newRule.a" list="cs-elements" :placeholder="elements[0] ?? 'X'" :aria-label="t('panel.element')" />
          <span>–</span>
          <input v-model="newRule.b" list="cs-elements" :placeholder="elements[0] ?? 'X'" :aria-label="t('panel.element')" />
          <span>≤</span>
          <input v-model.number="newRule.d" type="number" min="0.01" step="0.05" :aria-label="t('panel.ruleMax')" />
          <button class="small" @click="addRule">{{ t('panel.addRule') }}</button>
        </div>
      </template>
      <label class="check" :class="{ disabled: ui.viewMode !== 'structure' || prismLocks }">
        <input v-model="ui.clipToCell" type="checkbox" :disabled="ui.viewMode !== 'structure' || prismLocks" /> {{ t('panel.clip') }}
      </label>
      <p class="note">{{ t('panel.sphereNote') }}</p>
    </PanelCard>

    <PanelCard :index="num('cell')" term="cellParams" icon="cell" accent="sky">
      <!-- 設計模式：可編輯；受幾何約束的欄位停用並說明，無效輸入不套用 -->
      <template v-if="design">
        <div class="row-inline">
          <span>{{ t('panel.constraint') }}</span>
          <select :value="structure.geometryConstraint" :aria-label="t('panel.constraint')" @change="changeConstraint(($event.target as HTMLSelectElement).value)">
            <option v-for="c in GEOMETRY_CONSTRAINTS" :key="c" :value="c">{{ t(`constraint.${c}`) }}</option>
          </select>
        </div>
        <p class="note">{{ t('panel.constraintNote') }}</p>
        <div v-for="k in CELL_KEYS" :key="k" class="cell-row" :class="{ disabled: lockedCellKeys.has(k) }">
          <label :for="`cell-${k}`"><i>{{ CELL_LABEL[k] }}</i></label>
          <input
            :id="`cell-${k}`"
            type="number"
            :step="k.length === 1 ? 0.01 : 0.5"
            :value="cellDraft[k]"
            :disabled="lockedCellKeys.has(k)"
            v-on="tx.field"
            @change="applyCell(k, ($event.target as HTMLInputElement).value)"
          />
          <span class="unit">{{ k.length === 1 ? unit.trim() : '°' }}</span>
        </div>
        <p v-if="cellError" class="error" role="alert">{{ cellError }}</p>
        <p class="note">{{ t('panel.cellHint') }}</p>
      </template>
      <template v-else>
        <table class="params">
          <tr v-for="[k, v] in cellRows" :key="k">
            <th>{{ k }}</th>
            <td>{{ v }}</td>
          </tr>
        </table>
        <p class="todo">{{ t('panel.readonly') }}</p>
      </template>
    </PanelCard>

    <PanelCard :index="num('repeat')" term="repeat" icon="repeat" accent="mint">
      <div v-for="[key, label] in AXES" :key="key" class="repeat-row" :class="{ disabled: prismLocks && key !== 'repeatC' }">
        <label :for="key">{{ label }}</label>
        <input
          :id="key"
          type="range"
          min="1"
          max="5"
          :value="structure.repeat[key]"
          :disabled="prismLocks && key !== 'repeatC'"
          @input="structure.setRepeat({ [key]: +($event.target as HTMLInputElement).value })"
        />
        <output>{{ structure.repeat[key] }}</output>
      </div>
      <div class="presets">
        <button
          v-for="n in PRESETS"
          :key="n"
          :disabled="prismLocks"
          @click="structure.setRepeat({ repeatA: n, repeatB: n, repeatC: n })"
        >
          {{ n }}×{{ n }}×{{ n }}
        </button>
      </div>
      <p v-if="prismLocks" class="note">{{ t('panel.prismLocks', { n: 3 * structure.repeat.repeatC }) }}</p>
      <p v-else class="note">{{ t('panel.cellCount', { n: structure.repeat.repeatA * structure.repeat.repeatB * structure.repeat.repeatC }) }}</p>
    </PanelCard>

    <PanelCard :index="num('atom')" term="atomPosition" icon="atom" accent="violet">
      <template v-if="design">
        <p class="note">{{ t('panel.atomHint') }}</p>
        <div class="atom-actions">
          <button class="small" @click="structure.addAtom(elements[0] ?? 'X')">{{ t('panel.addAtom') }}</button>
          <button class="ghost small" :disabled="!selected" @click="selected && structure.removeAtom(selected.id)">{{ t('panel.removeAtom') }}</button>
        </div>
        <template v-if="selected">
          <p class="sub-label">{{ selected.id }}</p>
          <div class="cell-row">
            <label for="atom-element">{{ t('panel.element') }}</label>
            <input id="atom-element" :value="selected.element" list="cs-elements" @change="applyElement(($event.target as HTMLInputElement).value)" />
            <span class="unit"><span class="swatch" :style="{ background: selected.color ?? elementStyle(selected.element).color }" /></span>
          </div>
          <div v-for="axis in FRAC_KEYS" :key="axis" class="cell-row">
            <label :for="`frac-${axis}`"><i>{{ FRAC_LABEL[axis] }}</i></label>
            <input
              :id="`frac-${axis}`"
              type="number"
              step="0.01"
              :value="selected.fractionalPosition[axis]"
              v-on="tx.field"
              @input="applyFrac(axis, ($event.target as HTMLInputElement).value, false)"
              @change="applyFrac(axis, ($event.target as HTMLInputElement).value, true)"
            />
            <span class="unit" />
          </div>
        </template>
        <p v-else class="todo">{{ t('panel.noSelection') }}</p>
        <ul v-if="conflictText.length" class="warnings">
          <li v-for="(w, i) in conflictText" :key="i">{{ w }}</li>
        </ul>
      </template>
      <p v-else class="todo">{{ t('panel.readonly') }}</p>
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
      <label class="check" :class="{ disabled: prismLocks }">
        <input v-model="structure.repeat.showBoundaryImages" type="checkbox" :disabled="prismLocks" /> {{ t('panel.boundary') }}
      </label>
      <div class="row-inline">
        <span>{{ t('panel.projection') }}</span>
        <div class="segmented" role="group" :aria-label="t('panel.projectionAria')">
          <button :aria-pressed="ui.projection === 'perspective'" :title="t('panel.perspectiveTitle')" @click="ui.projection = 'perspective'">{{ term('perspective') }}</button>
          <button :aria-pressed="ui.projection === 'orthographic'" :title="t('panel.orthographicTitle')" @click="ui.projection = 'orthographic'">{{ term('orthographic') }}</button>
        </div>
      </div>
      <p v-if="ui.projection === 'perspective'" class="note">{{ t('panel.perspectiveNote') }}</p>
    </PanelCard>

    <!-- 元素符號建議清單（設計模式的輸入框共用） -->
    <datalist id="cs-elements">
      <option v-for="e in ELEMENT_OPTIONS" :key="e" :value="e">{{ l(elementStyle(e).name) }}</option>
    </datalist>
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
.title-input {
  display: block;
  width: 100%;
  margin: 6px 0 8px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.25;
}
.title-input:focus {
  outline: none;
  border-color: var(--accent);
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
  display: inline-block;
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
.param-row,
.cell-row {
  display: grid;
  grid-template-columns: 2.5em 1fr 3.5em;
  align-items: center;
  gap: 10px;
  margin: 4px 0;
  font-size: 0.88rem;
}
.cell-row {
  grid-template-columns: 3.5em 1fr 2.5em;
}
.cell-row input,
.rule-row input,
.row-inline select {
  width: 100%;
  min-height: 34px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
}
.row-inline select {
  width: auto;
  flex: 1 1 auto;
}
.cell-row input:focus,
.rule-row input:focus,
.row-inline select:focus {
  outline: none;
  border-color: var(--accent);
}
.cell-row.disabled {
  opacity: 0.5;
}
.cell-row .unit {
  color: var(--muted);
  font-size: 0.8rem;
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
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0 2px;
  font-size: 0.88rem;
  color: var(--text-2);
}
/* 標籤不折成直排；按鈕群放不下時整組換行 */
.row-inline > span {
  flex: none;
  white-space: nowrap;
}
.row-inline .segmented {
  flex: 1 1 auto;
  min-width: 0;
}
.todo {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.repeat-row.disabled {
  opacity: 0.45;
}
.param-ref {
  font-size: 0.84rem;
  color: var(--muted);
}
.copy-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.small {
  padding: 4px 10px;
  font-size: 0.8rem;
}
/* 來源參考：可收合，避免被誤讀為草稿現況 */
.source-ref {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.source-ref summary {
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-2);
}
.source-ref .meta {
  margin-top: 8px;
}
.rule-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 4.5em auto;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  font-size: 0.84rem;
  color: var(--muted);
}
.atom-actions {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}
.warnings {
  margin: 10px 0 0;
  padding: 8px 10px 8px 24px;
  border: 1px solid var(--warn);
  border-radius: 10px;
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 0.8rem;
  line-height: 1.5;
}
.error {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: var(--rose);
}
</style>
