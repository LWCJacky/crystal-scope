<script setup lang="ts">
import { computed } from 'vue'
import { KNOWLEDGE } from '../data/knowledge'
import { useI18n } from '../i18n'

/** 情境知識提示：可收合的一小段說明（摘要、細節、公式、常見誤解、來源）。外部連結只在使用者點擊時開啟。 */
const props = defineProps<{ id: keyof typeof KNOWLEDGE }>()
const { t, l } = useI18n()
const entry = computed(() => KNOWLEDGE[props.id])
</script>

<template>
  <details v-if="entry" class="hint">
    <summary>
      <span class="label">{{ t('knowledge.title') }}</span>
      <b>{{ l(entry.title) }}</b>
      <span class="summary">{{ l(entry.summary) }}</span>
    </summary>
    <p v-for="(d, i) in entry.details" :key="i" class="body">{{ l(d) }}</p>
    <p v-if="entry.formula" class="formula">{{ entry.formula }}</p>
    <p class="scope">{{ l(entry.scope) }}</p>
    <p class="mistakes-title">{{ t('knowledge.mistakes') }}</p>
    <ul class="mistakes">
      <li v-for="(m, i) in entry.commonMistakes" :key="i">{{ l(m) }}</li>
    </ul>
    <p class="sources">
      {{ t('knowledge.sources') }}：
      <a v-for="s in entry.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.label }}</a>
      <span class="status">{{ entry.reviewStatus === 'reviewed' ? t('knowledge.reviewed') : t('knowledge.draft') }}</span>
    </p>
  </details>
</template>

<style scoped>
.hint {
  margin: 10px 0 4px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--text-2);
}
summary {
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.label {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 700;
}
.summary {
  display: block;
  color: var(--muted);
}
.body {
  margin: 8px 0 0;
}
.formula {
  margin: 6px 0 0;
  padding: 4px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.78rem;
}
.scope {
  margin: 6px 0 0;
  color: var(--muted);
}
.mistakes-title {
  margin: 8px 0 2px;
  font-weight: 700;
}
.mistakes {
  margin: 0;
  padding-left: 18px;
}
.sources {
  margin: 8px 0 0;
  color: var(--muted);
}
.sources a {
  margin-right: 8px;
  color: var(--accent);
}
.status {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 0.7rem;
}
</style>
