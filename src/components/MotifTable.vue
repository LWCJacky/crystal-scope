<script setup lang="ts">
import { computed } from 'vue'
import { centeringTranslations } from '../core/centering'
import { elementStyle } from '../data/elements'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import { useStructureStore } from '../stores/structure'
import { formatPosition } from '../utils/format'
import { useI18n } from '../i18n'

const structure = useStructureStore()
const { termParts } = useI18n()

const translations = computed(() => centeringTranslations(structure.lattice.centering))
</script>

<template>
  <!-- 與課程投影片相同的「Lattice point | Motif (atoms)」表格 -->
  <table class="motif-table">
    <thead>
      <tr>
        <th>{{ termParts('latticePoint').label }} <span v-if="termParts('latticePoint').en" class="en">{{ termParts('latticePoint').en }}</span></th>
        <th>{{ termParts('motif').label }} <span v-if="termParts('motif').en" class="en">{{ termParts('motif').en }}</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div v-for="t in translations" :key="t.vector.join()" class="row">
            <span class="swatch" :style="{ background: LATTICE_POINT_KINDS[t.kind].color }" />
            {{ formatPosition(t.vector) }}
          </div>
        </td>
        <td>
          <div v-for="atom in structure.basis" :key="atom.id" class="row">
            <span class="swatch" :style="{ background: elementStyle(atom.element).color }" />
            <b>{{ atom.element }}</b>
            {{ atom.positionLabel ?? formatPosition(atom.fractionalPosition) }}
          </div>
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
  white-space: nowrap;
}
.swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}
</style>
