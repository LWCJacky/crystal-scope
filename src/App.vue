<script setup lang="ts">
import AnimationBar from './components/AnimationBar.vue'
import AppHeader from './components/AppHeader.vue'
import ControlPanel from './components/ControlPanel.vue'
import GuideTour from './components/GuideTour.vue'
import SystemList from './components/SystemList.vue'
import ViewportCanvas from './components/ViewportCanvas.vue'
import { useDemoClock } from './composables/useDemoClock'
import { onMounted, watchEffect } from 'vue'
import { useI18n } from './i18n'
import { LOCALES } from './i18n/types'
import { useUiStore } from './stores/ui'

const ui = useUiStore()
const { t, locale } = useI18n()
useDemoClock()

// 介面語言：同步 <html lang>、頁面標題與 meta 描述
watchEffect(() => {
  document.documentElement.lang = LOCALES.find((l) => l.id === locale.value)?.htmlLang ?? 'en'
  document.title = `CrystalScope｜${t('app.subtitle')}`
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'))
})

// 第一次造訪：先讓預設範例的建構動畫播一段，再開啟導覽
onMounted(() => {
  if (!ui.tourSeen) setTimeout(() => ui.openTour(), 1200)
})
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
  <GuideTour />
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 236px 1fr 356px;
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
/* 3D 檢視區：極淡的中心光暈，讓模型從深色背景中浮出 */
.area-center {
  background: radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--violet) 7%, transparent), transparent 65%);
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
  padding: 18px 16px 24px;
  background: var(--bg);
}

/* 投影模式：隱藏次要設定、放大字級（M5 細化） */
.layout[data-mode='presentation'] {
  font-size: 1.2rem;
  grid-template-columns: 256px 1fr 0;
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
