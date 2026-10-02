<script setup lang="ts">
import { ref } from 'vue'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'
import ModuleIcon from './icons/ModuleIcon.vue'
import SettingsDialog from './SettingsDialog.vue'
import AboutDialog from './AboutDialog.vue'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n/types'
import { useSettingsStore } from '../stores/settings'

const structure = useStructureStore()
const ui = useUiStore()
const settings = useSettingsStore()
const { t } = useI18n()
const settingsDialog = ref<InstanceType<typeof SettingsDialog>>()
const aboutDialog = ref<InstanceType<typeof AboutDialog>>()

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
        <p class="sub">{{ t('app.subtitle') }}</p>
      </div>
    </div>
    <nav class="actions">
      <div class="segmented" role="group" :aria-label="t('header.mode')">
        <button :aria-pressed="ui.mode === 'explore'" @click="ui.mode = 'explore'">{{ t('header.explore') }}</button>
        <button :aria-pressed="ui.mode === 'presentation'" @click="ui.mode = 'presentation'">{{ t('header.presentation') }}</button>
      </div>
      <span class="divider" aria-hidden="true" />
      <button class="ghost" :disabled="!structure.canUndo" :title="`${t('header.undo')} (Undo)`" @click="structure.undo()">{{ t('header.undo') }}</button>
      <button class="ghost" :disabled="!structure.canRedo" :title="`${t('header.redo')} (Redo)`" @click="structure.redo()">{{ t('header.redo') }}</button>
      <button :title="t('header.resetTitle')" @click="reset">{{ t('header.reset') }}</button>
      <span class="divider" aria-hidden="true" />
      <div class="segmented" role="group" :aria-label="t('header.language')" data-tour="language">
        <button
          v-for="l in LOCALES"
          :key="l.id"
          :lang="l.htmlLang"
          :aria-pressed="settings.values.locale === l.id"
          @click="settings.values.locale = l.id"
        >
          {{ l.label }}
        </button>
      </div>
      <span class="divider" aria-hidden="true" />
      <button data-tour="settings" :title="t('header.settingsTitle')" @click="settingsDialog?.open()">{{ t('header.settings') }}</button>
      <button data-tour="about" :title="t('header.aboutTitle')" @click="aboutDialog?.open()">{{ t('header.about') }}</button>
      <button data-tour="help" class="primary" :title="t('header.helpTitle')" @click="ui.openTour()">{{ t('header.help') }}</button>
    </nav>
    <SettingsDialog ref="settingsDialog" />
    <AboutDialog ref="aboutDialog" />
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
/* 手機：單列，動作列可橫向滑動（瀏覽器保留直向捲動） */
@media (max-width: 860px) {
  .app-header {
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px 12px;
    padding-top: calc(8px + env(safe-area-inset-top, 0px));
  }
  .brand {
    gap: 8px;
    flex: none;
  }
  .sub {
    display: none;
  }
  .actions {
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    touch-action: pan-x;
    padding-bottom: 2px;
    /* 右緣淡出：提示還有更多按鈕可以滑 */
    mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
  }
  .actions::-webkit-scrollbar {
    display: none;
  }
  .actions > * {
    flex: none;
  }
}
</style>
