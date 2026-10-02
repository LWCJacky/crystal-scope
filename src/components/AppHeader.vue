<script setup lang="ts">
import { ref } from 'vue'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'
import ModuleIcon from './icons/ModuleIcon.vue'
import SettingsDialog from './SettingsDialog.vue'

const structure = useStructureStore()
const ui = useUiStore()
const settingsDialog = ref<InstanceType<typeof SettingsDialog>>()

function reset() {
  structure.resetExample()
  ui.requestViewReset()
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="icon-tile logo"><ModuleIcon name="crystal" /></span>
      <div>
        <h1 class="title">CrystalScope</h1>
        <p class="sub">晶體結構觀察室</p>
      </div>
    </div>
    <nav class="actions">
      <div class="segmented" role="group" aria-label="模式">
        <button :aria-pressed="ui.mode === 'explore'" @click="ui.mode = 'explore'">探索</button>
        <button :aria-pressed="ui.mode === 'presentation'" @click="ui.mode = 'presentation'">投影</button>
      </div>
      <span class="divider" aria-hidden="true" />
      <button class="ghost" :disabled="!structure.canUndo" title="復原 Undo" @click="structure.undo()">復原</button>
      <button class="ghost" :disabled="!structure.canRedo" title="重做 Redo" @click="structure.redo()">重做</button>
      <button title="還原範例並重置視角" @click="reset">重置</button>
      <span class="divider" aria-hidden="true" />
      <button data-tour="settings" title="共用設定（以 cookie 保存）" @click="settingsDialog?.open()">設定</button>
      <button data-tour="help" class="primary" title="開啟使用導覽" @click="ui.openTour()">說明</button>
    </nav>
    <SettingsDialog ref="settingsDialog" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  --accent: var(--violet);
}
.title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.sub {
  margin: 1px 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--muted);
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .divider {
    display: none;
  }
}
.divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--border);
}
</style>
