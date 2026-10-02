<script setup lang="ts">
import { computed } from 'vue'
import { LATTICE_POINT_KINDS } from '../data/latticePointKinds'
import type { AtomInfo } from '../render/CrystalRenderer'
import { formatPosition } from '../utils/format'
import { useI18n } from '../i18n'

/**
 * 原子懸停資訊卡：從球體位置「長」出來，一條細引線連回球心。
 * 位置由父層以 transform 更新（每次繪製後跟著球體），卡片本身只做 opacity／scale 的進退場。
 */
const props = defineProps<{
  info: AtomInfo | null
  /** 球心畫面座標與半徑（CSS 像素）。 */
  x: number
  y: number
  radius: number
  /** 卡片放在球的哪一側（接近畫面右緣時翻到左側）。 */
  side: 'right' | 'left'
  color: string
}>()

const GAP = 14
const { t, term } = useI18n()

const kind = computed(() => (props.info ? LATTICE_POINT_KINDS[props.info.pointKind] : null))
const kindName = computed(() => (kind.value ? t(kind.value.nameKey) : ''))
const kindPos = computed(() => (kind.value?.position ? kind.value.position : t('kind.facePos')))
const title = computed(() =>
  props.info?.kind === 'latticePoint' ? t('card.kindPoint', { kind: kindName.value }) : `${props.info?.element}　${props.info?.elementZh}`,
)
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
  <div class="hover-layer" aria-hidden="true">
    <span class="lead" :class="{ on: !!info }" :style="leadStyle" />
    <div class="anchor" :style="anchorStyle">
      <div class="card" :class="[side, { on: !!info }]" :style="{ '--atom': color }">
        <template v-if="info">
          <p class="eyebrow">{{ info.kind === 'latticePoint' ? term('latticePoint') : t('card.motifAtom', { n: info.motifIndex }) }}</p>
          <h4>{{ title }}</h4>
          <dl>
            <dt>{{ t('card.frac') }}</dt>
            <dd class="mono">{{ info.positionLabel ?? formatPosition(info.frac) }}</dd>
            <dt>{{ t('card.point') }}</dt>
            <dd><span class="dot" :style="{ background: kind?.color }" />{{ kindName }} {{ kindPos }}</dd>
            <dt>{{ t('card.offset') }}</dt>
            <dd class="mono">{{ formatPosition(info.cellOffset) }}</dd>
            <dt v-if="info.kind === 'atom'">{{ t('card.bonds') }}</dt>
            <dd v-if="info.kind === 'atom'">{{ info.bondCount ? t('card.bondCount', { n: info.bondCount }) : t('card.bondUndefined') }}</dd>
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
}
</style>
