<script setup lang="ts">
import { computed, ref } from 'vue'
import { ASSIGNMENT_EXT, SUBMISSION_EXT, TEACHER_KEY_EXT, type AssignmentFile } from '../core/assignment'
import { ALL_EXAMPLES } from '../data/examples'
import { useAssignmentStore } from '../stores/assignment'
import { useStructureStore } from '../stores/structure'
import { readTextFile } from '../services/fileIo'
import ModuleIcon from './icons/ModuleIcon.vue'
import { useI18n } from '../i18n'

const assignment = useAssignmentStore()
const structure = useStructureStore()
const { t, l } = useI18n()
const dialog = ref<HTMLDialogElement>()
const tab = ref<'student' | 'teacher'>('student')

function open(which: 'student' | 'teacher' = assignment.mode === 'teacher' ? 'teacher' : 'student') {
  tab.value = which
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
/** 有表單的對話框不以「點暗幕」關閉：密碼管理器的彈出選單、拖曳選字放開在外面都會誤觸。只用 ✕ 或 Esc。 */
defineExpose({ open })

const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { hour12: false }) : '')

// ───────── 學生 ─────────
const pending = ref<AssignmentFile | null>(null)
const studentError = ref<string | null>(null)
const who = ref({ studentId: '', name: '' })
const fingerprint = ref('')
const confirmLeave = ref(false)

async function onAssignmentFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  studentError.value = null
  try {
    const result = await assignment.inspectAssignment(JSON.parse(await readTextFile(file)))
    if (!result.ok) studentError.value = t('assign.fileError', { reason: result.error })
    else pending.value = result.value
  } catch (err) {
    studentError.value = t('assign.fileError', { reason: err instanceof Error ? err.message : String(err) })
  }
}
function start() {
  if (!pending.value) return
  const missing = assignment.startAssignment(pending.value, who.value)
  if (missing) {
    studentError.value = t(missing === 'studentId' ? 'assign.needStudentId' : 'assign.needName')
    return
  }
  pending.value = null
  fingerprint.value = ''
  close()
}
async function submit() {
  const fp = await assignment.submit()
  fingerprint.value = fp ?? ''
}
function leave() {
  if (!confirmLeave.value) {
    confirmLeave.value = true
    return
  }
  confirmLeave.value = false
  assignment.leaveAssignment()
}
const startExampleName = computed(() => {
  const id = pending.value?.assignment.startExample ?? assignment.assignment?.assignment.startExample
  const ex = id ? ALL_EXAMPLES.find((e) => e.id === id) : null
  return ex ? l(ex.name) : t('assign.startCurrent')
})

// ───────── 老師 ─────────
const form = ref({ title: '', instructions: '', startExample: structure.exampleId as string | null, lockExamples: true, requireStudentId: true, requireName: true, password: '', password2: '' })
/** 密碼管理器自動填入不一定會送 input 事件：送出時以欄位實際值為準。 */
const pwInput = ref<HTMLInputElement>()
const pwInput2 = ref<HTMLInputElement>()
const teacherError = ref<string | null>(null)
const created = ref<AssignmentFile | null>(null)
const busy = ref(false)
async function create() {
  teacherError.value = null
  form.value.password = pwInput.value?.value ?? form.value.password
  form.value.password2 = pwInput2.value?.value ?? form.value.password2
  if (!form.value.title.trim()) return (teacherError.value = t('assign.needTitle'))
  if (form.value.password.length < 8) return (teacherError.value = t('assign.weakPassword'))
  if (form.value.password !== form.value.password2) return (teacherError.value = t('assign.passwordMismatch'))
  busy.value = true
  try {
    created.value = await assignment.createAndDownload(
      { title: form.value.title.trim(), instructions: form.value.instructions.trim(), startExample: form.value.startExample, lockExamples: form.value.lockExamples, requireStudentId: form.value.requireStudentId, requireName: form.value.requireName },
      form.value.password,
    )
    form.value.password = form.value.password2 = ''
  } finally {
    busy.value = false
  }
}
const keyPassword = ref('')
const keyUnlockInput = ref<HTMLInputElement>()
const keyFileJson = ref<unknown>(null)
const keyFileName = ref('')
const gradeError = ref<string | null>(null)
async function onKeyFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  keyFileName.value = file.name
  try {
    keyFileJson.value = JSON.parse(await readTextFile(file))
  } catch {
    gradeError.value = t('assign.fileError', { reason: 'not JSON' })
  }
}
async function unlock() {
  gradeError.value = null
  if (!keyFileJson.value) return (gradeError.value = t('assign.needKeyFile'))
  const err = await assignment.loadTeacherKeys(keyFileJson.value, keyUnlockInput.value?.value ?? keyPassword.value)
  if (err) gradeError.value = t('assign.fileError', { reason: err })
  keyPassword.value = ''
}
async function onSubmissionFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  for (const file of files) {
    try {
      await assignment.addSubmission(file.name, JSON.parse(await readTextFile(file)))
    } catch (err) {
      assignment.submissions.push({ fileName: file.name, result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
function view(i: number) {
  assignment.viewSubmission(i)
  close()
}
</script>

<template>
  <dialog ref="dialog" class="assign" aria-labelledby="assign-title">
    <div class="inner">
      <header>
        <div class="head-title">
          <span class="icon-tile"><ModuleIcon name="atom" /></span>
          <div>
            <p class="eyebrow">{{ t('assign.eyebrow') }}</p>
            <h2 id="assign-title">{{ t('assign.title') }}</h2>
          </div>
        </div>
        <button class="close ghost" :aria-label="t('settings.close')" @click="close">✕</button>
      </header>
      <div class="segmented tabs" role="tablist">
        <button role="tab" :aria-pressed="tab === 'student'" @click="tab = 'student'">{{ t('assign.tabStudent') }}</button>
        <button role="tab" :aria-pressed="tab === 'teacher'" @click="tab = 'teacher'">{{ t('assign.tabTeacher') }}</button>
      </div>
      <p class="note guarantee">{{ t('assign.guarantee') }}</p>

      <!-- ───────── 學生 ───────── -->
      <section v-if="tab === 'student'">
        <template v-if="assignment.mode === 'student' && assignment.assignment">
          <h3>{{ assignment.assignment.assignment.title }}</h3>
          <p v-if="assignment.assignment.assignment.instructions" class="instructions">{{ assignment.assignment.assignment.instructions }}</p>
          <dl class="meta">
            <dt>{{ t('assign.identity') }}</dt>
            <dd>{{ [assignment.identity.studentId, assignment.identity.name].filter(Boolean).join(' · ') }}</dd>
            <dt>{{ t('assign.startedAt') }}</dt>
            <dd>{{ fmtTime(assignment.startedAt) }}</dd>
            <dt>{{ t('assign.locks') }}</dt>
            <dd>{{ assignment.assignment.assignment.lockExamples ? t('assign.lockBoth') : t('assign.lockImports') }}</dd>
          </dl>
          <p class="note">{{ t('assign.submitNote') }}</p>
          <div class="actions">
            <button class="primary" @click="submit">{{ t('assign.submit') }}</button>
            <button class="ghost" @click="leave">{{ confirmLeave ? t('assign.leaveConfirm') : t('assign.leave') }}</button>
          </div>
          <p v-if="fingerprint" class="fingerprint"><b>{{ t('assign.fingerprint') }}</b><code>{{ fingerprint }}</code><span class="note">{{ t('assign.fingerprintNote') }}</span></p>
        </template>
        <template v-else-if="pending">
          <h3>{{ pending.assignment.title }}</h3>
          <p v-if="pending.assignment.instructions" class="instructions">{{ pending.assignment.instructions }}</p>
          <dl class="meta">
            <dt>{{ t('assign.startExample') }}</dt>
            <dd>{{ startExampleName }}</dd>
            <dt>{{ t('assign.locks') }}</dt>
            <dd>{{ pending.assignment.lockExamples ? t('assign.lockBoth') : t('assign.lockImports') }}</dd>
          </dl>
          <p class="note">{{ t('assign.startWarning') }}</p>
          <label v-if="pending.assignment.requireStudentId" class="field"><span>{{ t('assign.studentId') }}</span><input v-model="who.studentId" type="text" autocomplete="off" /></label>
          <label v-if="pending.assignment.requireName" class="field"><span>{{ t('assign.name') }}</span><input v-model="who.name" type="text" autocomplete="off" /></label>
          <p v-if="studentError" class="error" role="alert">{{ studentError }}</p>
          <div class="actions">
            <button class="primary" @click="start">{{ t('assign.start') }}</button>
            <button class="ghost" @click="pending = null">{{ t('assign.cancel') }}</button>
          </div>
        </template>
        <template v-else>
          <p class="note">{{ t('assign.studentIntro', { ext: ASSIGNMENT_EXT }) }}</p>
          <label class="file-btn">
            <input type="file" :accept="ASSIGNMENT_EXT + ',.json'" class="sr-only" @change="onAssignmentFile" />
            <span class="btn primary">{{ t('assign.importAssignment') }}</span>
          </label>
          <p v-if="studentError" class="error" role="alert">{{ studentError }}</p>
        </template>
      </section>

      <!-- ───────── 老師 ───────── -->
      <section v-else>
        <h3>{{ t('assign.createTitle') }}</h3>
        <label class="field"><span>{{ t('assign.formTitle') }}</span><input v-model="form.title" type="text" /></label>
        <label class="field"><span>{{ t('assign.formInstructions') }}</span><textarea v-model="form.instructions" rows="3" /></label>
        <label class="field">
          <span>{{ t('assign.startExample') }}</span>
          <select v-model="form.startExample">
            <option :value="null">{{ t('assign.startCurrent') }}</option>
            <option v-for="e in ALL_EXAMPLES" :key="e.id" :value="e.id">{{ l(e.name) }} · {{ e.nameEn }}</option>
          </select>
        </label>
        <label class="check"><input v-model="form.lockExamples" type="checkbox" /> {{ t('assign.formLock') }}</label>
        <label class="check"><input v-model="form.requireStudentId" type="checkbox" /> {{ t('assign.formReqId') }}</label>
        <label class="check"><input v-model="form.requireName" type="checkbox" /> {{ t('assign.formReqName') }}</label>
        <label class="field"><span>{{ t('assign.keyPassword') }}</span><input ref="pwInput" v-model="form.password" type="password" autocomplete="new-password" /></label>
        <label class="field"><span>{{ t('assign.keyPassword2') }}</span><input ref="pwInput2" v-model="form.password2" type="password" autocomplete="new-password" /></label>
        <p class="note">{{ t('assign.keyNote', { a: ASSIGNMENT_EXT, k: TEACHER_KEY_EXT }) }}</p>
        <p v-if="teacherError" class="error" role="alert">{{ teacherError }}</p>
        <div class="actions">
          <button class="primary" :disabled="busy" @click="create">{{ t('assign.create') }}</button>
        </div>
        <p v-if="created" class="ok">{{ t('assign.created', { title: created.assignment.title }) }}</p>

        <h3 class="gap">{{ t('assign.gradeTitle') }}</h3>
        <template v-if="!assignment.teacherKeys">
          <p class="note">{{ t('assign.gradeIntro', { k: TEACHER_KEY_EXT }) }}</p>
          <label class="file-btn">
            <input type="file" :accept="TEACHER_KEY_EXT + ',.json'" class="sr-only" @change="onKeyFile" />
            <span class="btn">{{ keyFileName || t('assign.chooseKey') }}</span>
          </label>
          <label class="field"><span>{{ t('assign.keyPassword') }}</span><input ref="keyUnlockInput" v-model="keyPassword" type="password" autocomplete="current-password" @keydown.enter.prevent="unlock" /></label>
          <p v-if="gradeError" class="error" role="alert">{{ gradeError }}</p>
          <div class="actions"><button class="primary" @click="unlock">{{ t('assign.unlock') }}</button></div>
        </template>
        <template v-else>
          <p class="note">{{ t('assign.gradeLoaded', { title: assignment.teacherKeys.title, time: fmtTime(assignment.teacherKeys.createdAt) }) }}</p>
          <label class="file-btn">
            <input type="file" :accept="SUBMISSION_EXT + ',.json'" multiple class="sr-only" @change="onSubmissionFiles" />
            <span class="btn primary">{{ t('assign.addSubmissions') }}</span>
          </label>
          <table v-if="assignment.submissions.length" class="list">
            <thead>
              <tr><th>{{ t('assign.studentId') }}</th><th>{{ t('assign.name') }}</th><th>{{ t('assign.submittedAt') }}</th><th>{{ t('assign.verified') }}</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in assignment.submissions" :key="i" :class="{ bad: !s.result || !s.result.verified, viewing: assignment.viewing === i }">
                <template v-if="s.result">
                  <td>{{ s.result.payload.identity.studentId }}</td>
                  <td>{{ s.result.payload.identity.name }}</td>
                  <td>{{ fmtTime(s.result.payload.submittedAt) }}</td>
                  <td :title="s.result.verifyNote">{{ s.result.verified ? '✓' : '✗' }}</td>
                  <td><button class="small" @click="view(i)">{{ t('assign.view') }}</button></td>
                </template>
                <template v-else>
                  <td colspan="5" class="error">{{ s.fileName }}：{{ s.error }}</td>
                </template>
              </tr>
            </tbody>
          </table>
          <div class="actions">
            <button :disabled="!assignment.submissions.some((s) => s.result)" @click="assignment.exportCsv()">{{ t('assign.exportCsv') }}</button>
            <button class="ghost" @click="assignment.closeTeacher()">{{ t('assign.closeTeacher') }}</button>
          </div>
        </template>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.assign {
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  --accent: var(--amber);
  border: 1px solid var(--border-strong);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.assign::backdrop {
  background: rgba(8, 10, 14, 0.55);
}
.inner {
  padding: 18px 20px 20px;
  overflow-y: auto;
  max-height: calc(100dvh - 32px);
  overscroll-behavior: contain;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 1.15rem;
}
h3 {
  margin: 14px 0 6px;
  font-size: 0.98rem;
}
h3.gap {
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.tabs {
  display: flex;
  margin-bottom: 8px;
}
.tabs button {
  flex: 1 1 0;
}
.guarantee {
  margin: 0 0 6px;
}
.note {
  margin: 6px 0;
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--muted);
}
.instructions {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  font-size: 0.88rem;
  line-height: 1.6;
  white-space: pre-wrap;
}
.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 6px 0;
  font-size: 0.84rem;
}
.meta dt {
  color: var(--muted);
}
.meta dd {
  margin: 0;
}
.field {
  display: grid;
  gap: 3px;
  margin: 8px 0;
  font-size: 0.82rem;
  color: var(--text-2);
}
.field input,
.field textarea,
.field select {
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 0.9rem;
}
.field textarea {
  resize: vertical;
}
.field input:focus,
.field textarea:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}
.check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 6px 0;
  font-size: 0.86rem;
  color: var(--text-2);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 4px;
}
.file-btn {
  display: inline-block;
  margin: 6px 0;
}
.file-btn .btn {
  display: inline-block;
  padding: 7px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-weight: 700;
}
.file-btn .btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.error {
  margin: 6px 0;
  font-size: 0.82rem;
  color: var(--rose);
}
.ok {
  margin: 6px 0;
  font-size: 0.84rem;
  color: var(--mint);
}
.fingerprint {
  margin: 10px 0 0;
  font-size: 0.8rem;
}
.fingerprint code {
  display: block;
  margin: 4px 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}
.small {
  padding: 3px 10px;
  font-size: 0.78rem;
}
.list {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.list th,
.list td {
  padding: 5px 6px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.list tr.bad td {
  color: var(--rose);
}
.list tr.viewing td {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
