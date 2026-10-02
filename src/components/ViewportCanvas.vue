<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { directionVector, validateIndices } from '../core/direction'
import { fracToCart } from '../core/lattice'
import { generateCellEdges } from '../core/periodic'
import type { Vec3 } from '../core/types'
import { CrystalRenderer, type SceneData } from '../render/CrystalRenderer'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

const structure = useStructureStore()
const ui = useUiStore()
const host = ref<HTMLDivElement>()
let renderer: CrystalRenderer | null = null

/** 示意配色與半徑；非真實元素尺寸。 */
const ELEMENT_COLORS: Record<string, string> = { X: '#4f7fe0', A: '#e07a4f', B: '#5fb07a' }

function blockCorner(): Vec3 {
  const r = structure.repeat
  return [r.repeatA, r.repeatB, r.repeatC]
}

function buildScene(): SceneData {
  const basis = structure.latticeBasis
  const { a, b, c } = structure.cell
  const radius = 0.12 * Math.min(a, b, c)
  const atomsById = new Map(structure.basis.map((atom) => [atom.id, atom]))
  const corner = blockCorner()

  let arrow: SceneData['arrow'] = null
  const d = structure.direction
  if (structure.directionEnabled && validateIndices(d.u, d.v, d.w).valid) {
    const v = directionVector(basis, d.u, d.v, d.w)
    arrow = { origin: fracToCart(basis, d.origin), vector: v.map((x) => x * d.displayLength) as Vec3 }
  }

  return {
    basis,
    atoms: structure.images.map((img) => {
      const atom = atomsById.get(img.baseId)!
      return {
        baseId: img.baseId,
        position: fracToCart(basis, img.fractionalPosition),
        color: atom.color ?? ELEMENT_COLORS[atom.element] ?? '#888888',
        radius: atom.displayRadius ?? radius,
        isBoundaryImage: img.isBoundaryImage,
      }
    }),
    cellEdges: generateCellEdges(structure.repeat).map(([p, q]) => [fracToCart(basis, p), fracToCart(basis, q)]),
    center: fracToCart(basis, corner.map((n) => n / 2) as Vec3),
    arrow,
    showAxes: ui.showAxes,
    showCellEdges: ui.showCellEdges,
  }
}

function resetView() {
  const basis = structure.latticeBasis
  const corner = fracToCart(basis, blockCorner())
  renderer?.resetView(fracToCart(basis, blockCorner().map((n) => n / 2) as Vec3), Math.hypot(...corner))
}

onMounted(() => {
  renderer = new CrystalRenderer(host.value!)
  // 於 renderer 建立後才開始追蹤；任何結構或顯示設定變動都會重建場景
  watchEffect(() => {
    if (structure.cellValidation.valid) renderer?.update(buildScene())
  })
  watch(() => [ui.viewResetToken, structure.systemId], resetView)
  resetView()
})

onBeforeUnmount(() => {
  renderer?.dispose()
  renderer = null
})
</script>

<template>
  <div ref="host" class="viewport" aria-label="3D 晶體模型檢視區" />
</template>

<style scoped>
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
}
.viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
