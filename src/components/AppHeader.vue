<script setup lang="ts">
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

const structure = useStructureStore()
const ui = useUiStore()

function reset() {
  structure.resetExample()
  ui.requestViewReset()
}
</script>

<template>
  <header class="app-header">
    <h1 class="title">CrystalScope <span class="sub">晶體結構觀察室</span></h1>
    <nav class="actions">
      <div class="segmented" role="group" aria-label="模式">
        <button :aria-pressed="ui.mode === 'explore'" @click="ui.mode = 'explore'">探索</button>
        <button :aria-pressed="ui.mode === 'presentation'" @click="ui.mode = 'presentation'">投影</button>
      </div>
      <button :disabled="!structure.canUndo" title="復原 Undo" @click="structure.undo()">復原</button>
      <button :disabled="!structure.canRedo" title="重做 Redo" @click="structure.redo()">重做</button>
      <button title="還原範例並重置視角" @click="reset">重置</button>
      <button disabled title="說明（M5）">說明</button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 650;
}
.sub {
  margin-left: 6px;
  font-weight: 400;
  color: var(--muted);
  font-size: 0.9rem;
}
.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.segmented {
  display: inline-flex;
}
.segmented button:first-child {
  border-radius: 6px 0 0 6px;
}
.segmented button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}
</style>
