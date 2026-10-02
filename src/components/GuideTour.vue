<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import { TOUR_STEPS } from '../data/tourSteps'
import { useUiStore } from '../stores/ui'
import { useI18n } from '../i18n'

const ui = useUiStore()
const reduced = useReducedMotion()
const { t, locale } = useI18n()

const step = computed(() => TOUR_STEPS[ui.tourStep])
const isLast = computed(() => ui.tourStep === TOUR_STEPS.length - 1)

/** 高亮區域（視窗座標）；null 表示置中的歡迎卡。 */
const rect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)
const card = ref<HTMLElement>()
const nextButton = ref<HTMLButtonElement>()
const cardSize = ref({ w: 340, h: 220 })

const PAD = 6
const GAP = 14
const MARGIN = 16
const NARROW = 640

function measure() {
  // 導覽關閉時不做任何版面讀取（捲動、縮放事件仍會進來）
  if (!ui.tourOpen) return
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  const target = step.value?.target ? document.querySelector<HTMLElement>(step.value.target) : null
  if (!target) {
    rect.value = null
  } else {
    const r = target.getBoundingClientRect()
    // 只取在視窗內可見的部分，避免高亮框超出畫面
    const x = Math.max(r.left, 0)
    const y = Math.max(r.top, 0)
    rect.value = { x, y, w: Math.min(r.right, vw.value) - x, h: Math.min(r.bottom, vh.value) - y }
  }
  if (card.value) cardSize.value = { w: card.value.offsetWidth, h: card.value.offsetHeight }
}

/**
 * 暗幕以 clip-path（evenodd）挖出高亮區；被挖空處不攔截滑鼠，使用者可直接操作高亮的區域。
 * 歡迎卡時挖空區縮成畫面中心的一點，讓轉場能連續。
 */
const clipPath = computed(() => {
  const r = rect.value
  const [x0, y0, x1, y1] = r
    ? [r.x - PAD, r.y - PAD, r.x + r.w + PAD, r.y + r.h + PAD]
    : [vw.value / 2, vh.value / 2, vw.value / 2, vh.value / 2]
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px, ${x0}px ${y0}px)`
})

/** 卡片位置：依序嘗試高亮區的右、左、下、上，最後夾在視窗內；窄螢幕改為底部卡片。 */
const cardStyle = computed(() => {
  if (vw.value < NARROW) return {}
  const { w, h } = cardSize.value
  const r = rect.value
  if (!r) return { left: `${(vw.value - w) / 2}px`, top: `${(vh.value - h) / 2}px` }
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw.value - w - MARGIN)
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh.value - h - MARGIN)
  const midY = r.y + r.h / 2 - h / 2
  let pos: [number, number]
  if (r.x + r.w + GAP + w + MARGIN <= vw.value) pos = [r.x + r.w + GAP, clampY(midY)]
  else if (r.x - GAP - w >= MARGIN) pos = [r.x - GAP - w, clampY(midY)]
  else if (r.y + r.h + GAP + h + MARGIN <= vh.value) pos = [clampX(r.x), r.y + r.h + GAP]
  else if (r.y - GAP - h >= MARGIN) pos = [clampX(r.x), r.y - GAP - h]
  else pos = [clampX(r.x + r.w / 2 - w / 2), clampY(midY)]
  return { left: `${pos[0]}px`, top: `${pos[1]}px` }
})

/** runEnter：往前走時才執行該步的示範（切換範例等）；退回上一步只重新定位，不重載範例。 */
async function show(index: number, runEnter = true) {
  ui.tourStep = index
  if (runEnter) TOUR_STEPS[index].enter?.()
  // 等待範例切換造成的版面變動完成後再定位
  await nextTick()
  const target = step.value.target ? document.querySelector<HTMLElement>(step.value.target) : null
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced.value ? 'auto' : 'smooth' })
  requestAnimationFrame(() => {
    measure()
    nextButton.value?.focus({ preventScroll: true })
  })
}

const next = () => (isLast.value ? ui.closeTour() : show(ui.tourStep + 1))
const prev = () => ui.tourStep > 0 && show(ui.tourStep - 1, false)

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** 焦點鎖定：Tab 只在卡片內循環（aria-modal 的對話框不應讓焦點跑到背景）。 */
function trapTab(e: KeyboardEvent) {
  const nodes = card.value ? [...card.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (!card.value?.contains(active)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function onKey(e: KeyboardEvent) {
  if (!ui.tourOpen) return
  if (e.key === 'Escape') ui.closeTour()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'Tab') trapTab(e)
}

/** 開啟前的焦點元素，關閉導覽後還原。 */
let previousFocus: HTMLElement | null = null

watch(
  () => ui.tourOpen,
  (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      show(ui.tourStep)
    } else {
      previousFocus?.focus?.({ preventScroll: true })
      previousFocus = null
    }
  },
)

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', measure)
  // 面板捲動時跟著更新高亮區
  window.addEventListener('scroll', measure, true)
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(document.body)
  if (ui.tourOpen) show(ui.tourStep)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div v-if="ui.tourOpen" class="tour" :class="{ reduced }">
    <div class="scrim" :style="{ clipPath, opacity: rect ? 1 : 0.75 }" @click="next" />
    <Transition name="card" mode="out-in" @after-enter="measure">
      <section
        :key="ui.tourStep"
        ref="card"
        class="card"
        :class="{ sheet: vw < NARROW }"
        :style="cardStyle"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`tour-title-${ui.tourStep}`"
      >
        <div class="top">
          <span class="num-badge">{{ String(ui.tourStep + 1).padStart(2, '0') }}</span>
          <p class="eyebrow">{{ t('tour.eyebrow', { n: TOUR_STEPS.length }) }}</p>
        </div>
        <h2 :id="`tour-title-${ui.tourStep}`">{{ step.title[locale] }}</h2>
        <p v-for="(line, i) in step.body[locale]" :key="i" class="body">{{ line }}</p>
        <div class="dots" aria-hidden="true">
          <span v-for="(_, i) in TOUR_STEPS" :key="i" :class="{ on: i === ui.tourStep }" />
        </div>
        <div class="actions">
          <button class="skip ghost" @click="ui.closeTour()">{{ t('tour.skip') }}</button>
          <button :disabled="ui.tourStep === 0" @click="prev">{{ t('tour.prev') }}</button>
          <button ref="nextButton" class="primary" @click="next">{{ isLast ? t('tour.start') : t('tour.next') }}</button>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}
.scrim {
  position: absolute;
  inset: 0;
  background: rgba(8, 10, 14, 0.62);
  pointer-events: auto;
  /* 高亮區在步驟之間滑動：畫面上的移動用 ease-in-out */
  transition:
    clip-path 300ms var(--ease-in-out),
    opacity 200ms var(--ease-out);
}
.card {
  --accent: var(--violet);
  position: absolute;
  width: min(380px, calc(100vw - 32px));
  padding: 18px 20px 16px;
  border: 1px solid var(--border-strong);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}
.card.sheet {
  left: 16px;
  right: 16px;
  bottom: 16px;
  width: auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
h2 {
  margin: 0 0 8px;
  font-size: 1.05rem;
}
.body {
  margin: 0 0 8px;
  font-size: 0.9rem;
  line-height: 1.75;
  color: var(--text-2);
}
.dots {
  display: flex;
  gap: 5px;
  margin: 10px 0 12px;
}
.dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
}
.dots span.on {
  background: var(--accent);
}
.actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.skip {
  margin-right: auto;
  color: var(--muted);
}

/* 卡片進場：首次／罕見的說明型 UI，200ms 強 ease-out；退場更快 */
.card-enter-active {
  transition:
    opacity 200ms var(--ease-out),
    transform 200ms var(--ease-out);
}
.card-leave-active {
  transition: opacity 120ms var(--ease-out);
}
.card-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
.card-leave-to {
  opacity: 0;
}

/* 減少動態效果：保留淡入淡出，移除位移與高亮區滑動 */
@media (prefers-reduced-motion: reduce) {
  .scrim {
    transition: opacity 200ms var(--ease-out);
  }
  .card-enter-from {
    transform: none;
  }
}
</style>
