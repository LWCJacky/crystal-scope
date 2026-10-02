<script setup lang="ts">
import AnimationBar from './components/AnimationBar.vue'
import AppHeader from './components/AppHeader.vue'
import ControlPanel from './components/ControlPanel.vue'
import GuideTour from './components/GuideTour.vue'
import ModuleIcon from './components/icons/ModuleIcon.vue'
import SystemList from './components/SystemList.vue'
import ViewportCanvas from './components/ViewportCanvas.vue'
import { useDemoClock } from './composables/useDemoClock'
import { MOBILE_QUERY, useMediaQuery } from './composables/useMediaQuery'
import { afterBoot } from './boot/report'
import { onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import { useI18n } from './i18n'
import { LOCALES } from './i18n/types'
import { useUiStore } from './stores/ui'

const ui = useUiStore()
const { t, locale } = useI18n()
useDemoClock()

/** 手機版面：側欄與播放列改為底部分頁＋可滑出的面板；桌面維持三欄。 */
const isMobile = useMediaQuery(MOBILE_QUERY)
const TABS = [
  { id: 'examples', icon: 'crystal', key: 'nav.examples' },
  { id: 'demo', icon: 'play', key: 'nav.demo' },
  { id: 'controls', icon: 'param', key: 'nav.controls' },
] as const

function toggleSheet(id: (typeof TABS)[number]['id']) {
  ui.sheet = ui.sheet === id ? null : id
}

// 離開手機版面時收合面板
watch(isMobile, (m) => {
  if (!m) ui.sheet = null
})

// 介面語言：同步 <html lang>、頁面標題與 meta 描述
watchEffect(() => {
  document.documentElement.lang = LOCALES.find((l) => l.id === locale.value)?.htmlLang ?? 'en'
  document.title = `CrystalScope｜${t('app.subtitle')}`
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'))
})

// 第一次造訪：等啟動層消失、建構動畫播一段後再開啟導覽
onMounted(() => {
  afterBoot(() => {
    if (!ui.tourSeen) setTimeout(() => ui.openTour(), 1200)
  })
})

// 執行中的未捕捉錯誤：以提示條告知，不中斷整站
const onRuntimeError = (e: Event) => (ui.runtimeError = String((e as CustomEvent<string>).detail))
onMounted(() => window.addEventListener('cs:runtime-error', onRuntimeError))
onBeforeUnmount(() => window.removeEventListener('cs:runtime-error', onRuntimeError))

// 手機：Esc 收合面板
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && ui.sheet) ui.sheet = null
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="layout" :class="{ mobile: isMobile }" :data-mode="ui.mode">
    <AppHeader class="area-header" />
    <template v-if="!isMobile">
      <SystemList class="area-left panel" />
    </template>
    <main class="area-center">
      <ViewportCanvas />
    </main>
    <template v-if="!isMobile">
      <ControlPanel class="area-right panel" />
      <AnimationBar class="area-bottom" />
    </template>

    <!-- 手機：底部分頁列（安全區內）＋ 從底部滑出的面板 -->
    <template v-else>
      <div class="scrim" :class="{ on: ui.sheet }" aria-hidden="true" @click="ui.sheet = null" />
      <section class="sheet" :class="{ open: ui.sheet }" :aria-hidden="!ui.sheet" :aria-label="ui.sheet ? t(`nav.${ui.sheet}`) : undefined">
        <button class="handle ghost" :aria-label="t('nav.close')" @click="ui.sheet = null"><span /></button>
        <div class="sheet-body">
          <SystemList v-show="ui.sheet === 'examples'" class="panel" />
          <AnimationBar v-show="ui.sheet === 'demo'" class="sheet-bar" />
          <ControlPanel v-show="ui.sheet === 'controls'" class="panel" />
        </div>
      </section>
      <nav class="tabbar area-bottom" :aria-label="t('header.mode')">
        <button v-for="tab in TABS" :key="tab.id" class="tab ghost" :aria-pressed="ui.sheet === tab.id" @click="toggleSheet(tab.id)">
          <ModuleIcon :name="tab.icon" />
          <span>{{ t(tab.key) }}</span>
        </button>
      </nav>
    </template>
  </div>
  <GuideTour />
  <Transition name="toast">
    <div v-if="ui.runtimeError" class="toast" role="alert">
      <span class="toast-text"><b>{{ t('error.runtime') }}</b> {{ ui.runtimeError }}</span>
      <a class="toast-link" href="https://github.com/LWCJacky/crystal-scope/issues" target="_blank" rel="noopener">{{ t('error.report') }}</a>
      <button class="ghost" :aria-label="t('settings.close')" @click="ui.runtimeError = null">✕</button>
    </div>
  </Transition>
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
  /* dvh：跟著手機瀏覽器網址列的收合變化，底部列不會被蓋住 */
  height: 100dvh;
}
.area-header {
  grid-area: header;
  min-width: 0;
}
.area-left {
  grid-area: left;
  border-right: 1px solid var(--border);
}
/* 3D 檢視區：極淡的中心光暈，讓模型從深色背景中浮出 */
.area-center {
  grid-area: center;
  min-width: 0;
  min-height: 0;
  background: radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--violet) 7%, transparent), transparent 65%);
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
  /* 面板到底時不把捲動傳給整頁 */
  overscroll-behavior: contain;
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

/* ───────── 手機版面 ───────── */
.layout.mobile,
.layout.mobile[data-mode='presentation'] {
  /* minmax(0, 1fr)：1fr 的下限是 min-content，否則橫向可捲動的標題列會把整欄撐寬 */
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: 'header' 'center' 'bottom';
  --tabbar-h: 56px;
}
.tabbar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  box-sizing: border-box;
  height: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border);
  background: var(--bg);
  /* 底部分頁列避開 Home 指示條 */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  position: relative;
  z-index: 40;
}
.tab {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 8px 4px 6px;
  border-radius: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  transition:
    color 160ms ease,
    transform 100ms var(--ease-out);
}
.tab svg {
  width: 22px;
  height: 22px;
}
.tab[aria-pressed='true'] {
  background: transparent;
  border-color: transparent;
  color: var(--accent);
}
.tab:active:not(:disabled) {
  transform: scale(0.94);
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(8, 10, 14, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms var(--ease-out);
}
.scrim.on {
  opacity: 1;
  pointer-events: auto;
}
/* 從底部滑出的面板：iOS 風格抽屜曲線；只動 transform */
.sheet {
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  position: fixed;
  left: 0;
  right: 0;
  /* 停在分頁列之上 */
  bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
  z-index: 35;
  /* 最多七成高：留一截 3D 畫面，點它也能收合 */
  max-height: min(72dvh, calc(100dvh - var(--tabbar-h) - env(safe-area-inset-bottom, 0px) - 56px));
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-strong);
  border-radius: 16px 16px 0 0;
  background: var(--surface);
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
  transform: translateY(calc(100% + 60px));
  transition: transform 280ms var(--ease-drawer);
  will-change: transform;
}
.sheet.open {
  transform: translateY(0);
}
.handle {
  display: grid;
  place-items: center;
  width: 100%;
  padding: 10px 0 6px;
  border-radius: 0;
}
.handle span {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-strong);
}
.sheet-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.sheet-body .panel {
  padding-top: 4px;
  background: transparent;
}
.sheet-bar {
  border-top: none;
  background: transparent;
  padding-bottom: 18px;
}
@media (prefers-reduced-motion: reduce) {
  .sheet {
    transition: opacity 200ms var(--ease-out);
    opacity: 0;
    transform: none;
  }
  .sheet.open {
    opacity: 1;
  }
  .tab:active:not(:disabled) {
    transform: none;
  }
}

/* 執行期錯誤提示條：右下角進出，不擋住操作（手機時避開分頁列） */
.toast {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(520px, calc(100vw - 32px));
  padding: 10px 12px 10px 14px;
  border: 1px solid var(--rose);
  border-left-width: 3px;
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.86rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.layout.mobile ~ .toast {
  bottom: calc(var(--tabbar-h) + 16px + env(safe-area-inset-bottom, 0px));
}
.toast-text {
  overflow-wrap: anywhere;
}
.toast-link {
  white-space: nowrap;
  color: var(--accent);
}
.toast-enter-active {
  transition:
    opacity 200ms var(--ease-out),
    transform 200ms var(--ease-out);
}
.toast-leave-active {
  transition: opacity 120ms var(--ease-out);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-from {
    transform: none;
  }
}
</style>
