<script setup lang="ts">
import ModuleIcon from './icons/ModuleIcon.vue'
import { useI18n } from '../i18n'
import type { TermKey } from '../i18n/terms'

/** 控制面板的模組卡片：色相左緣＋圖示方塊＋「模組 0X」小標＋標題（專業名詞附英文原文）。 */
defineProps<{
  index: number
  term: TermKey
  icon: InstanceType<typeof ModuleIcon>['$props']['name']
  accent: 'violet' | 'mint' | 'amber' | 'sky' | 'rose'
}>()
const { t, termParts } = useI18n()
</script>

<template>
  <section class="card" :style="{ '--card-accent': `var(--${accent})` }">
    <header class="card-head">
      <span class="icon-tile"><ModuleIcon :name="icon" /></span>
      <div>
        <p class="eyebrow">{{ t('panel.module', { n: String(index).padStart(2, '0') }) }}</p>
        <h3>
          {{ termParts(term).label }}<span v-if="termParts(term).en" class="en">{{ termParts(term).en }}</span>
        </h3>
      </div>
    </header>
    <slot />
  </section>
</template>
