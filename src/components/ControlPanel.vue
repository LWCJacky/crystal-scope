<script setup lang="ts">
import { computed } from 'vue'
import { useStructureStore } from '../stores/structure'
import { useUiStore } from '../stores/ui'

const structure = useStructureStore()
const ui = useUiStore()

const cellRows = computed(() => {
  const c = structure.cell
  return [
    ['a', c.a],
    ['b', c.b],
    ['c', c.c],
    ['α', `${c.alpha}°`],
    ['β', `${c.beta}°`],
    ['γ', `${c.gamma}°`],
  ]
})

const PRESETS = [1, 2, 3]
const AXES = [
  ['repeatA', 'Na'],
  ['repeatB', 'Nb'],
  ['repeatC', 'Nc'],
] as const
</script>

<template>
  <aside class="control-panel" aria-label="控制面板">
    <section>
      <h2 class="panel-title">
        {{ structure.source.nameZh }}晶系 <span class="en">{{ structure.source.nameEn }}</span>
      </h2>
      <p v-if="structure.isCustom" class="badge">自訂結構（來源範例：{{ structure.source.nameZh }}）</p>
      <dl class="meta">
        <dt>晶胞設定</dt>
        <dd>{{ structure.source.cellSetting }}</dd>
        <dt>幾何關係</dt>
        <dd>{{ structure.source.relations }}</dd>
      </dl>
      <p class="desc">{{ structure.source.description }}</p>
    </section>

    <section>
      <h3>晶胞參數 <span class="en">Cell parameters</span></h3>
      <table class="params">
        <tr v-for="[k, v] in cellRows" :key="k">
          <th>{{ k }}</th>
          <td>{{ v }}</td>
        </tr>
      </table>
      <p class="todo">編輯與教學鎖定：M2</p>
    </section>

    <section>
      <h3>週期排列 <span class="en">Repeat</span></h3>
      <div v-for="[key, label] in AXES" :key="key" class="repeat-row">
        <label :for="key">{{ label }}</label>
        <input
          :id="key"
          type="range"
          min="1"
          max="5"
          :value="structure.repeat[key]"
          @input="structure.setRepeat({ [key]: +($event.target as HTMLInputElement).value })"
        />
        <output>{{ structure.repeat[key] }}</output>
      </div>
      <div class="presets">
        <button
          v-for="n in PRESETS"
          :key="n"
          @click="structure.setRepeat({ repeatA: n, repeatB: n, repeatC: n })"
        >
          {{ n }}×{{ n }}×{{ n }}
        </button>
      </div>
    </section>

    <section>
      <h3>原子位置 <span class="en">Fractional x, y, z</span></h3>
      <p class="todo">選取與編輯分率座標：M1</p>
    </section>

    <section>
      <h3>晶向 <span class="en">Direction [uvw]</span></h3>
      <p class="todo">晶向箭頭與沿晶向觀看：M3</p>
    </section>

    <section>
      <h3>顯示 <span class="en">Display</span></h3>
      <label class="check"><input v-model="ui.showCellEdges" type="checkbox" /> 晶胞邊線</label>
      <label class="check"><input v-model="ui.showAxes" type="checkbox" /> 晶格向量 a、b、c</label>
      <label class="check"><input v-model="structure.repeat.showBoundaryImages" type="checkbox" /> 邊界複本（淡色）</label>
    </section>
  </aside>
</template>

<style scoped>
section + section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}
.en {
  color: var(--muted);
  font-weight: 400;
  font-size: 0.8rem;
}
.badge {
  display: inline-block;
  margin: 0 0 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 0.8rem;
}
.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  margin: 0 0 8px;
  font-size: 0.85rem;
}
.meta dt {
  color: var(--muted);
}
.meta dd {
  margin: 0;
}
.desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
}
.params {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.params th {
  text-align: left;
  padding: 2px 16px 2px 0;
  font-weight: 500;
  font-style: italic;
}
.repeat-row {
  display: grid;
  grid-template-columns: 2.5em 1fr 1.5em;
  align-items: center;
  gap: 8px;
}
.presets {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  margin: 4px 0;
}
.todo {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
