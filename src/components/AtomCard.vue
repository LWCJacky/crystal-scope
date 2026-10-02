<script setup lang="ts">
import { computed } from 'vue'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import type { AtomInfo } from '../render/CrystalRenderer'
import { formatPosition } from '../utils/format'
import { useI18n } from '../i18n'

/**
 * 原子資訊卡，兩種擺法：
 * - 浮動（滑鼠懸停）：從球體位置「長」出來，一條細引線連回球心；位置由父層以 transform 更新。
 * - 停靠（觸控輕點）：固定在檢視區底部，鏡頭已推近原子並把它放在上方，卡片不遮住主體。
 * 卡片本身只做 opacity／transform 的進退場。
 */
const props = defineProps<{
  info: AtomInfo | null
  /** 球心畫面座標與半徑（CSS 像素）；停靠模式不使用。 */
  x: number
  y: number
  radius: number
  /** 卡片放在球的哪一側（接近畫面右緣時翻到左側）。 */
  side: 'right' | 'left'
  color: string
  docked?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const GAP = 14
const { t, term } = useI18n()

const kind = computed(() => (props.info ? LATTICE_POINT_KINDS[props.info.pointKind] : null))
const kindName = computed(() => (kind.value ? t(kind.value.nameKey) : ''))
const kindPos = computed(() => (kind.value?.position ? kind.value.position : t('kind.facePos')))
const eyebrow = computed(() => (props.info?.kind === 'latticePoint' ? term('latticePoint') : t('card.motifAtom', { n: props.info?.motifIndex ?? 0 })))
const title = computed(() =>
  props.info?.kind === 'latticePoint' ? t('card.kindPoint', { kind: kindName.value }) : `${props.info?.element}　${props.info?.elementZh}`,
)
/** 兩種擺法共用的欄位列。 */
const rows = computed(() => {
  const info = props.info
  if (!info) return []
  const list: { dt: string; dd: string; mono?: boolean; dot?: string }[] = [
    { dt: t('card.frac'), dd: info.positionLabel ?? formatPosition(info.frac), mono: true },
    { dt: t('card.point'), dd: `${kindName.value} ${kindPos.value}`, dot: kind.value?.color },
    { dt: t('card.offset'), dd: formatPosition(info.cellOffset), mono: true },
  ]
  if (info.kind === 'atom') list.push({ dt: t('card.bonds'), dd: info.bondCount ? t('card.bondCount', { n: info.bondCount }) : t('card.bondUndefined') })
  return list
})

const anchorStyle = computed(() => {
  const dx = props.side === 'right' ? props.radius + GAP : -(props.radius + GAP)
  return { transform: `translate3d(${props.x + dx}px, ${props.y}px, 0)` }
})
const leadStyle = computed(() => {
  const start = props.side === 'right' ? props.x + props.radius : props.x - props.radius
  const len = GAP
  return { transform: `translate3d(${props.side === 'right' ? start : start - len}px, ${props.y}px, 0)`, width: `${len}px` }
})
</script>

<template>
  <!-- 停靠：檢視區底部，可操作（關閉鈕） -->
  <div v-if="docked" class="docked" :class="{ on: !!info }" :style="{ '--atom': color }" :aria-hidden="!info">
    <div class="card static">
      <template v-if="info">
        <div class="head">
          <div>
            <p class="eyebrow">{{ eyebrow }}</p>
            <h4>{{ title }}</h4>
          </div>
          <button class="ghost close" :aria-label="t('card.close')" @click="emit('close')">✕</button>
        </div>
        <dl>
          <template v-for="row in rows" :key="row.dt">
            <dt>{{ row.dt }}</dt>
            <dd :class="{ mono: row.mono }"><span v-if="row.dot" class="dot" :style="{ background: row.dot }" />{{ row.dd }}</dd>
          </template>
        </dl>
        <p class="note">{{ info.note }}</p>
      </template>
    </div>
  </div>
  <!-- 浮動：跟著球體 -->
  <div v-else class="hover-layer" aria-hidden="true">
    <span class="lead" :class="{ on: !!info }" :style="leadStyle" />
    <div class="anchor" :style="anchorStyle">
      <div class="card" :class="[side, { on: !!info }]" :style="{ '--atom': color }">
        <template v-if="info">
          <p class="eyebrow">{{ eyebrow }}</p>
          <h4>{{ title }}</h4>
          <dl>
            <template v-for="row in rows" :key="row.dt">
              <dt>{{ row.dt }}</dt>
              <dd :class="{ mono: row.mono }"><span v-if="row.dot" class="dot" :style="{ background: row.dot }" />{{ row.dd }}</dd>
            </template>
          </dl>
          <p class="note">{{ info.note }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.anchor,
.lead {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}
/* 引線：從球緣到卡片，與卡片同步淡入 */
.lead {
  height: 1px;
  background: var(--atom, var(--accent));
  opacity: 0;
  transition: opacity 160ms var(--ease-out);
}
.lead.on {
  opacity: 0.9;
}
.card {
  --accent: var(--atom, var(--violet));
  position: absolute;
  top: 0;
  width: 250px;
  padding: 10px 14px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
  border-left: 2px solid var(--accent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  /* 進場：從球體那一側長出來 */
  opacity: 0;
  transform: translateY(-50%) scale(0.94);
  transition:
    opacity 120ms var(--ease-out),
    transform 120ms var(--ease-out);
}
.card.right {
  left: 0;
  transform-origin: left center;
}
.card.left {
  right: 0;
  transform-origin: right center;
}
.card.on {
  opacity: 1;
  transform: translateY(-50%) scale(1);
  transition:
    opacity 160ms var(--ease-out),
    transform 160ms var(--ease-out);
}

/* 停靠：底部橫幅，從下方滑入；只動 opacity／transform */
.docked {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 120ms var(--ease-out),
    transform 120ms var(--ease-out);
}
.docked.on {
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 200ms var(--ease-out),
    transform 200ms var(--ease-out);
}
.card.static {
  position: static;
  width: auto;
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  transform: none;
  opacity: 1;
  transition: none;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.close {
  flex: none;
  min-width: 36px;
  min-height: 36px;
  margin: -4px -8px 0 0;
  padding: 0;
  border-radius: 50%;
}
h4 {
  margin: 2px 0 8px;
  font-size: 1rem;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  margin: 0;
  font-size: 0.8rem;
}
dt {
  color: var(--muted);
  font-weight: 600;
}
dd {
  margin: 0;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 5px;
}
.mono {
  font-variant-numeric: tabular-nums;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.note {
  margin: 8px 0 0;
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--text-2);
}
@media (prefers-reduced-motion: reduce) {
  .card,
  .card.on {
    transform: translateY(-50%);
    transition: opacity 160ms var(--ease-out);
  }
  .docked,
  .docked.on {
    transform: none;
    transition: opacity 160ms var(--ease-out);
  }
}
</style>
