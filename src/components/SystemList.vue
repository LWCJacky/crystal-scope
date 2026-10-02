<script setup lang="ts">
import { CRYSTAL_SYSTEMS } from '../data/crystalSystems'
import { useStructureStore } from '../stores/structure'

const structure = useStructureStore()
</script>

<template>
  <aside class="system-list" aria-label="七大晶系">
    <h2 class="panel-title">七大晶系 <span class="en">Crystal systems</span></h2>
    <ul>
      <li v-for="s in CRYSTAL_SYSTEMS" :key="s.id">
        <button :aria-current="structure.systemId === s.id" @click="structure.loadSystem(s.id)">
          <span class="zh">{{ s.nameZh }}</span>
          <span class="en">{{ s.nameEn }}</span>
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
li button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  text-align: left;
  border-color: transparent;
  background: transparent;
}
li button[aria-current='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.en {
  color: var(--muted);
  font-size: 0.8rem;
}
</style>
