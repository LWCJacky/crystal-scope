<script setup lang="ts">
/** 各模組的線條圖示（自繪，24×24 網格、1.8 線寬）。 */
defineProps<{ name: 'motif' | 'lattice' | 'sphere' | 'hex' | 'param' | 'cell' | 'repeat' | 'atom' | 'direction' | 'display' | 'play' | 'crystal' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- 結構 = 晶格點 + 基元：一點加兩顆原子 -->
    <template v-if="name === 'motif'">
      <circle cx="6" cy="17" r="2.2" />
      <circle cx="16" cy="7" r="3" />
      <circle cx="18.5" cy="15.5" r="2" />
      <path d="M7.6 15.4 13.8 9.2M8.2 17.2l8.3-1.2" stroke-dasharray="2 2.4" />
    </template>
    <!-- 布拉菲晶格：立方點陣 -->
    <template v-else-if="name === 'lattice'">
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </template>
    <!-- 球體：被切開的球 -->
    <template v-else-if="name === 'sphere'">
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <path d="M12 3.5V12h8.5A8.5 8.5 0 0 0 12 3.5z" opacity="0.5" />
    </template>
    <!-- 六方：六角柱 -->
    <template v-else-if="name === 'hex'">
      <path d="M8 4h8l4 3.5-4 3.5H8L4 7.5z" />
      <path d="M4 7.5v9L8 20h8l4-3.5v-9M8 11v9M16 11v9" />
    </template>
    <!-- 參數：滑桿 -->
    <template v-else-if="name === 'param'">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </template>
    <!-- 晶胞參數：斜平行六面體 -->
    <template v-else-if="name === 'cell'">
      <path d="M6 7h11l-2 4H4zM4 11v7h11v-7M17 7v7l-2 4" />
    </template>
    <!-- 週期排列：2×2 格 -->
    <template v-else-if="name === 'repeat'">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" opacity="0.5" />
    </template>
    <!-- 原子位置：十字準星 -->
    <template v-else-if="name === 'atom'">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </template>
    <!-- 晶向：箭頭 -->
    <template v-else-if="name === 'direction'">
      <path d="M5 19 19 5M11 5h8v8" />
    </template>
    <!-- 顯示：眼睛 -->
    <template v-else-if="name === 'display'">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </template>
    <!-- 播放 -->
    <template v-else-if="name === 'play'">
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </template>
    <!-- 標誌：晶體 -->
    <template v-else>
      <path d="M12 2.5 19 7v10l-7 4.5L5 17V7z" />
      <path d="M5 7l7 4.5L19 7M12 11.5v10" />
    </template>
  </svg>
</template>
