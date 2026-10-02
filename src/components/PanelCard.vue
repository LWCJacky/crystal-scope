<script setup lang="ts">
import ModuleIcon from './icons/ModuleIcon.vue'

/** 控制面板的模組卡片：色相左緣＋圖示方塊＋「模組 0X」小標＋標題。 */
defineProps<{
  index: number
  title: string
  en?: string
  icon: InstanceType<typeof ModuleIcon>['$props']['name']
  accent: 'violet' | 'mint' | 'amber' | 'sky' | 'rose'
}>()
</script>

<template>
  <section class="card" :style="{ '--card-accent': `var(--${accent})` }">
    <header class="card-head">
      <span class="icon-tile"><ModuleIcon :name="icon" /></span>
      <div>
        <p class="eyebrow">模組 {{ String(index).padStart(2, '0') }}</p>
        <h3>
          {{ title }}<span v-if="en" class="en">{{ en }}</span>
        </h3>
      </div>
    </header>
    <slot />
  </section>
</template>
