<script setup lang="ts">
import { computed } from 'vue'
import { centeringTranslations } from '../core/centering'
import { elementStyle } from '../data/elements'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import { useStructureStore } from '../stores/structure'
import { formatPosition } from '../utils/format'
import { useI18n } from '../i18n'

const structure = useStructureStore()
const { t, termParts } = useI18n()

const translations = computed(() => centeringTranslations(structure.centering))
/** 設計模式：點列選取原子（與 3D 點選同步）。 */
const selectable = computed(() => structure.editable)

function select(id: string) {
  if (!selectable.value) return
  structure.selectedAtomId = structure.selectedAtomId === id ? null : id
}
</script>

<template>
  <!-- 與課程投影片相同的「Lattice point | Motif (atoms)」表格；cellSites 表示時右欄為完整晶胞原子 -->
  <table class="motif-table">
    <thead>
      <tr>
        <th>{{ termParts('latticePoint').label }} <span v-if="termParts('latticePoint').en" class="en">{{ termParts('latticePoint').en }}</span></th>
        <th>
          <template v-if="structure.representation === 'cellSites'">{{ t('panel.repCellSitesShort') }}</template>
          <template v-else>{{ termParts('motif').label }} <span v-if="termParts('motif').en" class="en">{{ termParts('motif').en }}</span></template>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div v-for="tr in translations" :key="tr.vector.join()" class="row">
            <span class="swatch" :style="{ background: LATTICE_POINT_KINDS[tr.kind].color }" />
            {{ formatPosition(tr.vector) }}
          </div>
        </td>
        <td>
          <component
            :is="selectable ? 'button' : 'div'"
            v-for="atom in structure.basis"
            :key="atom.id"
            class="row"
            :class="{ selectable, selected: selectable && structure.selectedAtomId === atom.id }"
            :type="selectable ? 'button' : undefined"
            :aria-pressed="selectable ? structure.selectedAtomId === atom.id : undefined"
            @click="select(atom.id)"
          >
            <span class="swatch" :style="{ background: atom.color ?? elementStyle(atom.element).color }" />
            <b>{{ atom.element }}</b>
            {{ atom.positionLabel ?? formatPosition(atom.fractionalPosition) }}
          </component>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.motif-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}
th {
  text-align: left;
  font-weight: 800;
  padding: 6px 8px;
  background: var(--tint-bg);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}
th:first-child {
  border-radius: 8px 0 0 8px;
}
th:last-child {
  border-radius: 0 8px 8px 0;
}
td {
  vertical-align: top;
  padding: 8px;
  color: var(--text-2);
}
.en {
  font-weight: 400;
  color: var(--muted);
  font-size: 0.75rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.7;
}
/* 設計模式：列可點選；選中列以主題色描邊 */
button.row {
  width: 100%;
  padding: 1px 6px;
  margin: 0 -6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  min-height: 32px;
}
button.row.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}
.swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}
</style>
