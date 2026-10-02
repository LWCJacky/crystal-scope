<script setup lang="ts">
import { computed } from 'vue'
import { playDemo, useDemo } from '../composables/useDemo'
import { useUiStore } from '../stores/ui'
import { useI18n } from '../i18n'

const ui = useUiStore()
const { kind, duration } = useDemo()
const { t, term } = useI18n()

const active = computed(() => kind.value !== null)
const title = computed(() =>
  kind.value === 'ladder'
    ? t('bar.titleLadder')
    : kind.value === 'assembly'
      ? t('bar.titleAssembly')
      : kind.value === 'build'
        ? t('bar.titleBuild')
        : t('bar.titleNone'),
)

/** 進入／離開尺度之旅；進入時立即從公分尺度開始播放。 */
function toggleLadder() {
  ui.ladderOn = !ui.ladderOn
  if (ui.ladderOn) playDemo()
}
const SPEEDS = [0.5, 1, 2]

function togglePlay() {
  if (!ui.demoOn) return playDemo()
  ui.demoPlaying = !ui.demoPlaying
}

/** 直接跳到完成狀態，給已熟悉的使用者。 */
function skip() {
  ui.demoPlaying = false
  ui.demoTime = duration.value
}

function scrub(e: Event) {
  ui.demoOn = true
  ui.demoPlaying = false
  ui.demoTime = +(e.target as HTMLInputElement).value
}
</script>

<template>
  <footer class="animation-bar" :aria-label="t('bar.aria')">
    <div class="title">
      <p class="eyebrow">{{ term('demo') }}</p>
      <span>{{ title }}</span>
    </div>
    <button data-tour="ladder" :aria-pressed="ui.ladderOn" :title="t('bar.ladderTitle')" @click="toggleLadder">
      {{ ui.ladderOn ? t('bar.ladderExit') : term('scaleJourney') }}
    </button>
    <button :disabled="!active" @click="togglePlay">{{ ui.demoPlaying ? t('bar.pause') : t('bar.play') }}</button>
    <button :disabled="!active" @click="playDemo">{{ t('bar.replay') }}</button>
    <button :disabled="!active || !ui.demoOn || ui.demoTime >= duration" @click="skip">{{ t('bar.skip') }}</button>
    <input
      class="progress"
      type="range"
      min="0"
      :max="duration"
      step="0.01"
      :value="ui.demoOn ? ui.demoTime : duration"
      :disabled="!active"
      :aria-label="t('bar.progress')"
      @input="scrub"
    />
    <output class="time">{{ (ui.demoOn ? ui.demoTime : duration).toFixed(1) }} / {{ duration.toFixed(1) }} s</output>
    <div class="segmented" role="group" :aria-label="t('bar.speed')">
      <button
        v-for="s in SPEEDS"
        :key="s"
        :aria-pressed="ui.demoSpeed === s"
        :disabled="!active"
        @click="ui.demoSpeed = s"
      >
        {{ s }}×
      </button>
    </div>
    <div class="prefs">
      <label><input v-model="ui.autoplay" type="checkbox" /> {{ t('bar.autoplay') }}</label>
      <label :title="t('bar.autoRotateTitle')">
        <input v-model="ui.autoRotatePref" type="checkbox" /> {{ t('bar.autoRotate') }}
      </label>
    </div>
  </footer>
</template>

<style scoped>
.animation-bar {
  --accent: var(--violet);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  font-size: 0.85rem;
}
.title {
  display: grid;
  gap: 1px;
  min-width: 13em;
  font-weight: 800;
}

.progress {
  flex: 1 1 160px;
  max-width: 360px;
}
.time {
  min-width: 7.5em;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-weight: 700;
}
.prefs {
  display: flex;
  gap: 12px;
  margin-left: auto;
  color: var(--muted);
}
.prefs label {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
