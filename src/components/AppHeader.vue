<script setup lang="ts">
import { MOBILE_QUERY, useMediaQuery } from '../composables/useMediaQuery'
import { useUiStore } from '../stores/ui'
import HeaderActions from './HeaderActions.vue'
import ModuleIcon from './icons/ModuleIcon.vue'
import { useI18n } from '../i18n'

const ui = useUiStore()
const { t } = useI18n()
/** 手機：動作列移到底部「更多」面板，標題列只留品牌與「說明」。 */
const isMobile = useMediaQuery(MOBILE_QUERY)
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="icon-tile logo"><ModuleIcon name="crystal" /></span>
      <div>
        <h1 class="title">CrystalScope</h1>
        <p class="sub">{{ t('app.subtitle') }}</p>
      </div>
    </div>
    <HeaderActions v-if="!isMobile" />
    <button v-else class="primary help" :title="t('header.helpTitle')" @click="ui.openTour()">{{ t('header.help') }}</button>
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
  /* 瀏海／動態島：內容往下讓開，背景仍延伸到最頂 */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
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
.help {
  flex: none;
}
/* 手機：單列、精簡 */
@media (max-width: 860px) {
  .app-header {
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px 12px;
    padding-top: calc(8px + env(safe-area-inset-top, 0px));
  }
  .brand {
    gap: 8px;
    min-width: 0;
  }
  .sub {
    display: none;
  }
}
</style>
