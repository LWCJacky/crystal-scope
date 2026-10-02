<script setup lang="ts">
import AnimationBar from './components/AnimationBar.vue'
import AppHeader from './components/AppHeader.vue'
import ControlPanel from './components/ControlPanel.vue'
import SystemList from './components/SystemList.vue'
import ViewportCanvas from './components/ViewportCanvas.vue'
import { useUiStore } from './stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="layout" :data-mode="ui.mode">
    <AppHeader class="area-header" />
    <SystemList class="area-left panel" />
    <main class="area-center">
      <ViewportCanvas />
    </main>
    <ControlPanel class="area-right panel" />
    <AnimationBar class="area-bottom" />
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 200px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'header header header'
    'left center right'
    'bottom bottom bottom';
  height: 100dvh;
}
.area-header {
  grid-area: header;
}
.area-left {
  grid-area: left;
  border-right: 1px solid var(--border);
}
.area-center {
  grid-area: center;
  min-width: 0;
  min-height: 0;
}
.area-right {
  grid-area: right;
  border-left: 1px solid var(--border);
}
.area-bottom {
  grid-area: bottom;
}
.panel {
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--surface);
}

/* 投影模式：隱藏次要設定、放大字級（M5 細化） */
.layout[data-mode='presentation'] {
  font-size: 1.2rem;
  grid-template-columns: 220px 1fr 0;
}
.layout[data-mode='presentation'] .area-right {
  display: none;
}

/* 窄螢幕：暫以上下堆疊；抽屜／分頁於 M5 實作 */
@media (max-width: 860px) {
  .layout,
  .layout[data-mode='presentation'] {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 60dvh auto auto;
    grid-template-areas: 'header' 'left' 'center' 'right' 'bottom';
    height: auto;
  }
  .area-left,
  .area-right {
    border: none;
    border-bottom: 1px solid var(--border);
  }
}
</style>
