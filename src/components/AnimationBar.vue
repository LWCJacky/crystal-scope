<template>
  <footer class="animation-bar" aria-label="動畫控制">
    <button disabled>播放</button>
    <button disabled>暫停</button>
    <label>速度 <input type="range" min="0.25" max="2" step="0.25" value="1" disabled /></label>
    <span class="todo">建立與展開動畫：M4</span>
  </footer>
</template>

<style scoped>
.animation-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.85rem;
}
.todo {
  color: var(--muted);
}
</style>
