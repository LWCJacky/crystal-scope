<script setup lang="ts">
import { computed, ref } from 'vue'
import { AI_TOOLS, DEPENDENCIES, FONTS, PROJECT } from '../data/credits'
import { useI18n } from '../i18n'
import ModuleIcon from './icons/ModuleIcon.vue'

const dialog = ref<HTMLDialogElement>()
const { t } = useI18n()

const runtime = computed(() => DEPENDENCIES.filter((d) => d.role === 'runtime'))
const build = computed(() => DEPENDENCIES.filter((d) => d.role === 'build'))

function open() {
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
/** 點擊對話框外的暗幕即關閉。 */
function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) close()
}
defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="about" aria-labelledby="about-title" @click="onBackdrop">
    <form method="dialog" class="inner">
      <header>
        <div class="head-title">
          <span class="icon-tile"><ModuleIcon name="crystal" /></span>
          <div>
            <p class="eyebrow">{{ t('about.eyebrow') }}</p>
            <h2 id="about-title">{{ t('about.title') }}</h2>
          </div>
        </div>
        <button class="close ghost" :aria-label="t('about.close')" @click.prevent="close">✕</button>
      </header>

      <p class="summary">{{ t('about.summary') }}</p>
      <div class="chips">
        <span class="chip">{{ t('about.version', { v: PROJECT.version }) }}</span>
        <a class="chip link" :href="PROJECT.licenseUrl" target="_blank" rel="noopener">{{ PROJECT.license }}</a>
        <a class="chip link" :href="PROJECT.github" target="_blank" rel="noopener">GitHub ↗</a>
      </div>

      <dl class="facts">
        <dt>{{ t('about.author') }}</dt>
        <dd>{{ t('about.copyright', { year: PROJECT.year, author: PROJECT.author }) }}</dd>
        <dt>{{ t('about.license') }}</dt>
        <dd>{{ t('about.licenseNote', { license: PROJECT.license }) }}</dd>
        <dt>{{ t('about.github') }}</dt>
        <dd>
          <a :href="PROJECT.github" target="_blank" rel="noopener">{{ PROJECT.github.replace('https://', '') }}</a>
          <span class="muted"> · {{ t('about.githubNote') }}</span>
        </dd>
      </dl>

      <section>
        <h3>{{ t('about.deps') }}</h3>
        <p class="group">{{ t('about.runtime') }}</p>
        <ul class="deps">
          <li v-for="d in runtime" :key="d.name">
            <a :href="d.url" target="_blank" rel="noopener">{{ d.name }}</a>
            <span class="ver">{{ d.version }}</span>
            <span class="lic">{{ d.license }}</span>
          </li>
        </ul>
        <p class="group">{{ t('about.build') }}</p>
        <ul class="deps">
          <li v-for="d in build" :key="d.name">
            <a :href="d.url" target="_blank" rel="noopener">{{ d.name }}</a>
            <span class="ver">{{ d.version }}</span>
            <span class="lic">{{ d.license }}</span>
          </li>
        </ul>
        <p class="group">{{ t('about.fonts') }}</p>
        <ul class="deps">
          <li v-for="f in FONTS" :key="f.name">
            <a :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a>
            <span class="ver" />
            <span class="lic">{{ f.license }}</span>
          </li>
        </ul>
        <p class="note">{{ t('about.fontsNote') }}</p>
      </section>

      <section>
        <h3>{{ t('about.ai') }}</h3>
        <ul class="deps">
          <li v-for="a in AI_TOOLS" :key="a.name">
            <a :href="a.url" target="_blank" rel="noopener">{{ a.name }}</a>
            <span class="ver" />
            <span class="lic">{{ a.vendor }}</span>
          </li>
        </ul>
        <p class="note">{{ t('about.aiNote') }}</p>
      </section>

      <footer>
        <button type="button" class="primary" @click="close">{{ t('about.close') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.about {
  --accent: var(--sky);
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--border-strong);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.about::backdrop {
  background: rgba(8, 10, 14, 0.55);
}
.about[open] {
  animation: about-in 200ms var(--ease-out);
}
@keyframes about-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .about[open] {
    animation: about-fade 200ms var(--ease-out);
  }
  @keyframes about-fade {
    from {
      opacity: 0;
    }
  }
}
.inner {
  padding: 16px 18px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 1.05rem;
}
.summary {
  margin: 0 0 10px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-2);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.chip.link {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  text-decoration: none;
}
.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  margin: 0;
  padding: 10px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  font-size: 0.86rem;
  line-height: 1.55;
}
.facts dt {
  color: var(--muted);
  font-weight: 600;
}
.facts dd {
  margin: 0;
  color: var(--text-2);
}
.facts a,
.deps a {
  color: var(--accent);
  text-decoration: none;
}
.muted {
  color: var(--muted);
}
h3 {
  margin: 12px 0 2px;
  font-size: 0.95rem;
}
.group {
  margin: 8px 0 4px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--muted);
}
.deps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
  font-size: 0.84rem;
}
.deps li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: baseline;
}
.ver {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.lic {
  min-width: 7em;
  text-align: right;
  font-weight: 600;
  color: var(--text-2);
}
footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
</style>
