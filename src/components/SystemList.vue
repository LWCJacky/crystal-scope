<script setup lang="ts">
import { selectExample } from '../composables/selectExample'
import { CRYSTAL_SYSTEMS } from '../data/crystalSystems'
import { MATERIALS } from '../data/materials'
import { useStructureStore } from '../stores/structure'
import { useI18n } from '../i18n'

const structure = useStructureStore()
const { t, l, termParts } = useI18n()

const GROUPS = [
  { term: 'crystalSystems' as const, items: CRYSTAL_SYSTEMS, accent: 'violet' },
  { term: 'structures' as const, items: MATERIALS, accent: 'mint' },
]
</script>

<template>
  <aside class="system-list" :aria-label="t('list.aria')">
    <section v-for="(g, gi) in GROUPS" :key="g.term" class="group">
      <header class="group-head">
        <span class="num-badge">{{ String(gi + 1).padStart(2, '0') }}</span>
        <div>
          <h2>{{ termParts(g.term).label }}</h2>
          <p v-if="termParts(g.term).en" class="en">{{ termParts(g.term).en }}</p>
        </div>
      </header>
      <ul :style="{ '--accent': `var(--${g.accent})` }">
        <li v-for="s in g.items" :key="s.id">
          <button class="item" :aria-current="structure.exampleId === s.id" @click="selectExample(s.id)">
            <span class="zh">{{ l(s.name) }}</span>
            <span v-if="s.group !== 'system' || s.nameEn !== l(s.name)" class="tag">{{ s.group === 'system' ? s.nameEn : s.lattices[0].symbol }}</span>
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.group + .group {
  margin-top: 22px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 2px 10px;
}
.group-head h2 {
  margin: 0;
  font-size: 0.95rem;
}
.group-head .en {
  margin: 1px 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
}
/* 清單項目為長方形列，選中時加上色相左緣與淡色調底色 */
.item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 7px 10px 7px 12px;
  text-align: left;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  border-radius: 10px;
  color: var(--text-2);
}
@media (hover: hover) and (pointer: fine) {
  .item:hover:not([aria-current='true']) {
    border-color: var(--border);
    border-left-color: var(--border);
    background: var(--surface);
  }
}
.item[aria-current='true'] {
  border-color: var(--tint-border);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  border-left-color: var(--accent);
  background: var(--tint-bg);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  color: var(--text);
}
.zh {
  font-weight: 700;
}
.tag {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 600;
}
.item[aria-current='true'] .tag {
  color: var(--accent);
}
</style>
