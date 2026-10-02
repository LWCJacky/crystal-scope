<script setup lang="ts">
import { computed } from 'vue'
import { playDemo, useDemo } from '../composables/useDemo'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const { kind, duration } = useDemo()

const active = computed(() => kind.value !== null)
const title = computed(() =>
  kind.value === 'ladder'
    ? '尺度之旅：公分 → 晶粒 → 晶格 → 晶胞'
    : kind.value === 'assembly'
      ? '拼裝六方柱'
      : kind.value === 'build'
        ? '建構：晶格點 → 基元 → 結構'
        : '基元視圖無演示',
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
  <footer class="animation-bar" aria-label="演示動畫控制">
    <div class="title">
      <p class="eyebrow">演示</p>
      <span>{{ title }}</span>
    </div>
    <button data-tour="ladder" :aria-pressed="ui.ladderOn" title="由巨觀物件連續放大到晶胞（滾輪可推進）" @click="toggleLadder">
      {{ ui.ladderOn ? '離開尺度之旅' : '尺度之旅' }}
    </button>
    <button :disabled="!active" @click="togglePlay">{{ ui.demoPlaying ? '暫停' : '播放' }}</button>
    <button :disabled="!active" @click="playDemo">重播</button>
    <button :disabled="!active || !ui.demoOn || ui.demoTime >= duration" @click="skip">跳到結果</button>
    <input
      class="progress"
      type="range"
      min="0"
      :max="duration"
      step="0.01"
      :value="ui.demoOn ? ui.demoTime : duration"
      :disabled="!active"
      aria-label="演示進度"
      @input="scrub"
    />
    <output class="time">{{ (ui.demoOn ? ui.demoTime : duration).toFixed(1) }} / {{ duration.toFixed(1) }} s</output>
    <div class="segmented" role="group" aria-label="速度">
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
      <label><input v-model="ui.autoplay" type="checkbox" /> 點選範例時自動播放</label>
      <label title="拖曳模型即停止；偏好減少動態效果時不旋轉">
        <input v-model="ui.autoRotatePref" type="checkbox" /> 完成後自動旋轉
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
