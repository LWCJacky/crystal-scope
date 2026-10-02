<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import ModuleIcon from './icons/ModuleIcon.vue'

const settings = useSettingsStore()
const ui = useUiStore()
const dialog = ref<HTMLDialogElement>()

const s = settings.values

function open() {
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function replayTour() {
  close()
  ui.openTour()
}

/** 點擊對話框外的暗幕即關閉。 */
function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) close()
}

defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="settings" aria-labelledby="settings-title" @click="onBackdrop">
    <form method="dialog" class="inner">
      <header>
        <div class="head-title">
          <span class="icon-tile"><ModuleIcon name="param" /></span>
          <div>
            <p class="eyebrow">共用設定</p>
            <h2 id="settings-title">設定 <span class="en">Settings</span></h2>
          </div>
        </div>
        <button class="close ghost" aria-label="關閉" @click.prevent="close">✕</button>
      </header>

      <fieldset>
        <legend>演示與動畫</legend>
        <label class="check"><input v-model="s.autoplay" type="checkbox" /> 點選範例時自動播放演示</label>
        <label class="check"><input v-model="s.autoRotate" type="checkbox" /> 演示完成後自動旋轉</label>
        <div class="row">
          <label for="set-rot">自轉一圈</label>
          <input id="set-rot" v-model.number="s.autoRotateSeconds" type="range" min="10" max="120" step="5" :disabled="!s.autoRotate" />
          <output>{{ s.autoRotateSeconds }} 秒</output>
        </div>
        <div class="row">
          <span>演示速度</span>
          <div class="segmented" role="group" aria-label="演示速度">
            <button v-for="v in [0.5, 1, 2] as const" :key="v" type="button" :aria-pressed="s.demoSpeed === v" @click="s.demoSpeed = v">
              {{ v }}×
            </button>
          </div>
        </div>
        <div class="row">
          <span>六方柱拼裝</span>
          <div class="segmented" role="group" aria-label="六方柱拼裝方式">
            <button type="button" :aria-pressed="s.assemblyMode === 'wedge6'" @click="s.assemblyMode = 'wedge6'">6 塊三角柱</button>
            <button type="button" :aria-pressed="s.assemblyMode === 'cell3'" @click="s.assemblyMode = 'cell3'">3 個晶胞</button>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>顯示</legend>
        <label class="check"><input v-model="s.showCellEdges" type="checkbox" /> 晶胞邊線</label>
        <label class="check"><input v-model="s.showAxes" type="checkbox" /> 晶格向量 a、b、c</label>
        <label class="check"><input v-model="s.showAngles" type="checkbox" /> 晶軸夾角 α、β、γ</label>
        <label class="check"><input v-model="s.showBoundaryImages" type="checkbox" /> 邊界複本（淡色）</label>
        <label class="check"><input v-model="s.showBonds" type="checkbox" /> 鍵／最近鄰連線</label>
        <div class="row">
          <label for="set-size">球體大小</label>
          <input id="set-size" v-model.number="s.sphereScale" type="range" min="0.3" max="1.6" step="0.05" />
          <output>{{ s.sphereScale.toFixed(2) }}×</output>
        </div>
      </fieldset>

      <fieldset>
        <legend>介面</legend>
        <div class="row">
          <span>預設模式</span>
          <div class="segmented" role="group" aria-label="介面模式">
            <button type="button" :aria-pressed="s.appMode === 'explore'" @click="s.appMode = 'explore'">探索</button>
            <button type="button" :aria-pressed="s.appMode === 'presentation'" @click="s.appMode = 'presentation'">投影</button>
          </div>
        </div>
        <button type="button" class="link" @click="replayTour">重新觀看使用導覽 →</button>
      </fieldset>

      <p class="note">設定以 cookie 保存在此瀏覽器（一年有效，只記錄與預設不同的項目，不含個人資料）。瀏覽器會在載入本站時一併送出此 cookie，但本站為靜態網站，伺服器不會讀取或使用它。</p>

      <footer>
        <button type="button" @click="settings.reset()">恢復預設</button>
        <button type="button" class="primary" @click="close">完成</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.settings {
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  --accent: var(--violet);
  border: 1px solid var(--border-strong);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.settings::backdrop {
  background: rgba(8, 10, 14, 0.55);
}
/* 開啟：罕見操作，200ms 強 ease-out；模態框不錨定觸發點，維持置中縮放 */
.settings[open] {
  animation: settings-in 200ms var(--ease-out);
}
@keyframes settings-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .settings[open] {
    animation: settings-fade 200ms var(--ease-out);
  }
  @keyframes settings-fade {
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
  margin-bottom: 6px;
}
h2 {
  margin: 0;
  font-size: 1.05rem;
}
.en {
  color: var(--muted);
  font-weight: 400;
  font-size: 0.8rem;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
fieldset {
  border: none;
  border-top: 1px solid var(--border);
  margin: 10px 0 0;
  padding: 10px 0 0;
}
legend {
  padding: 0 8px 0 0;
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--accent);
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  font-size: 0.9rem;
}
.row {
  display: grid;
  grid-template-columns: 6em 1fr auto;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-size: 0.9rem;
}
.row .segmented {
  grid-column: 2 / -1;
}
output {
  min-width: 4em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.link {
  margin-top: 4px;
  border-color: transparent;
  color: var(--accent);
  padding-left: 0;
}
.note {
  margin: 12px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--muted);
}
footer {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
}
</style>
