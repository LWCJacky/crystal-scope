<script setup lang="ts">
import { ref } from 'vue'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'
import SettingsDialog from './SettingsDialog.vue'
import AboutDialog from './AboutDialog.vue'
import AssignmentDialog from './AssignmentDialog.vue'
import { useAssignmentStore } from '../stores/assignment'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n/types'
import { useSettingsStore } from '../stores/settings'

/**
 * 頂部動作列：模式、復原／重做／重置、語言、說明／設定／關於。
 * 桌面放在標題列（單列）；手機放進「更多」面板（stack：分組直排）。
 */
defineProps<{ stack?: boolean }>()

const structure = useStructureStore()
const ui = useUiStore()
const settings = useSettingsStore()
const { t } = useI18n()
const settingsDialog = ref<InstanceType<typeof SettingsDialog>>()
const aboutDialog = ref<InstanceType<typeof AboutDialog>>()
const assignmentDialog = ref<InstanceType<typeof AssignmentDialog>>()
const assignment = useAssignmentStore()

function reset() {
  structure.resetExample()
  ui.requestViewReset()
}
</script>

<template>
  <nav class="actions" :class="{ stack }" :aria-label="t('header.mode')">
    <div class="group">
      <span v-if="stack" class="group-label">{{ t('header.workspace') }}</span>
      <div class="segmented" role="group" :aria-label="t('header.workspace')" data-tour="workspace">
        <button :aria-pressed="structure.workspace === 'learn'" :title="t('header.learnTitle')" @click="structure.setWorkspace('learn')">{{ t('header.learn') }}</button>
        <button :aria-pressed="structure.workspace === 'design'" :title="t('header.designTitle')" @click="structure.setWorkspace('design')">{{ t('header.design') }}</button>
      </div>
    </div>
    <span v-if="!stack" class="divider" aria-hidden="true" />
    <div class="group">
      <span v-if="stack" class="group-label">{{ t('header.mode') }}</span>
      <div class="segmented" role="group" :aria-label="t('header.mode')">
        <button :aria-pressed="ui.mode === 'explore'" @click="ui.mode = 'explore'">{{ t('header.explore') }}</button>
        <button :aria-pressed="ui.mode === 'presentation'" @click="ui.mode = 'presentation'">{{ t('header.presentation') }}</button>
      </div>
    </div>
    <span v-if="!stack" class="divider" aria-hidden="true" />
    <div class="group">
      <div class="buttons">
        <button class="ghost" :disabled="!structure.canUndo" :title="`${t('header.undo')} (Undo)`" @click="structure.undo()">{{ t('header.undo') }}</button>
        <button class="ghost" :disabled="!structure.canRedo" :title="`${t('header.redo')} (Redo)`" @click="structure.redo()">{{ t('header.redo') }}</button>
        <button :title="t('header.resetTitle')" @click="reset">{{ t('header.reset') }}</button>
      </div>
    </div>
    <span v-if="!stack" class="divider" aria-hidden="true" />
    <div class="group">
      <span v-if="stack" class="group-label">{{ t('header.language') }}</span>
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
    </div>
    <span v-if="!stack" class="divider" aria-hidden="true" />
    <div class="group tools">
      <div class="buttons">
        <button data-tour="settings" :title="t('header.settingsTitle')" @click="settingsDialog?.open()">{{ t('header.settings') }}</button>
        <button data-tour="about" :title="t('header.aboutTitle')" @click="aboutDialog?.open()">{{ t('header.about') }}</button>
        <button data-tour="assignment" :class="{ 'assign-on': assignment.mode !== 'off' }" :title="t('header.assignmentTitle')" @click="assignmentDialog?.open()">{{ t('header.assignment') }}</button>
        <button data-tour="help" class="primary" :title="t('header.helpTitle')" @click="ui.openTour()">{{ t('header.help') }}</button>
      </div>
    </div>
    <SettingsDialog ref="settingsDialog" />
    <AboutDialog ref="aboutDialog" />
    <AssignmentDialog ref="assignmentDialog" />
  </nav>
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.group,
.buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 作業模式進行中：按鈕以琥珀色標示 */
.assign-on {
  border-color: var(--amber);
  color: var(--amber);
}
.divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--border);
}

/* 手機「更多」面板：分組直排，按鈕撐滿、好點；說明／設定／關於最常用，排最上面（導覽也聚焦得到） */
.actions.stack {
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  padding: 4px 16px 8px;
}
.stack .tools {
  order: -1;
}
.stack .group {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.stack .group-label {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--muted);
}
.stack .segmented,
.stack .buttons {
  display: flex;
  width: 100%;
}
.stack .segmented > button,
.stack .buttons > button {
  flex: 1 1 0;
  min-height: 44px;
}
.stack .buttons {
  gap: 8px;
}
</style>
