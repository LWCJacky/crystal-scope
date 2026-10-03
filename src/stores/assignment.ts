import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  ASSIGNMENT_EXT,
  createAssignment,
  createSubmission,
  isTeacherKeys,
  openSubmission,
  SUBMISSION_EXT,
  submissionsCsv,
  TEACHER_KEY_EXT,
  verifyAssignmentFile,
  type AssignmentFile,
  type AssignmentSpec,
  type OpenedSubmission,
  type SubmissionIdentity,
  type TeacherKeys,
} from '../core/assignment'
import { decryptWithPassword, encryptWithPassword, isPasswordEnvelope, sha256Hex } from '../core/crypto'
import { formatFormula } from '../core/stats'
import { downloadText, safeFilename } from '../services/fileIo'
import { useStructureStore } from './structure'

const SESSION_KEY = 'crystalscope_assignment_session'

interface StudentSession {
  assignment: AssignmentFile
  identity: SubmissionIdentity
  startedAt: string
}

/**
 * 作業模式：學生端（匯入題目 → 鎖定 → 加密繳交）與老師端（建立題目與金鑰 → 批改）。
 * 全部純前端；金鑰只存在老師自己的檔案裡，網站不保存、不連外。
 */
export const useAssignmentStore = defineStore('assignment', () => {
  const structure = useStructureStore()
  const mode = ref<'off' | 'student' | 'teacher'>('off')
  const assignment = ref<AssignmentFile | null>(null)
  const identity = ref<SubmissionIdentity>({ studentId: '', name: '' })
  const startedAt = ref('')
  /** 最後一次繳交檔的 SHA-256 指紋（可填到 LMS 防掉包）。 */
  const lastFingerprint = ref('')

  const teacherKeys = ref<TeacherKeys | null>(null)
  const submissions = ref<{ fileName: string; result: OpenedSubmission | null; error: string | null }[]>([])
  /** 老師目前檢視的繳交（索引）。 */
  const viewing = ref<number | null>(null)

  const active = computed(() => mode.value === 'student')
  const title = computed(() => assignment.value?.assignment.title ?? '')

  function persist() {
    try {
      if (mode.value === 'student' && assignment.value) {
        const session: StudentSession = { assignment: assignment.value, identity: identity.value, startedAt: startedAt.value }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* 無法存取 localStorage 時忽略 */
    }
  }

  function applyLocks() {
    const spec = assignment.value?.assignment
    structure.locks.imports = mode.value === 'student'
    structure.locks.examples = mode.value === 'student' && !!spec?.lockExamples
  }

  /** 學生：驗證題目檔；成功後回傳題目（尚未開始）。 */
  async function inspectAssignment(json: unknown) {
    return verifyAssignmentFile(json)
  }

  /** 學生：開始作業——強制重新初始化為起始範例的草稿、鎖定匯入／範例切換、記錄身分與時間。 */
  function startAssignment(file: AssignmentFile, who: SubmissionIdentity): string | null {
    const spec = file.assignment
    if (spec.requireStudentId && !who.studentId.trim()) return 'studentId'
    if (spec.requireName && !who.name.trim()) return 'name'
    mode.value = 'student'
    assignment.value = file
    identity.value = { studentId: who.studentId.trim(), name: who.name.trim() }
    startedAt.value = new Date().toISOString()
    structure.locks.imports = false
    structure.locks.examples = false
    structure.setWorkspace('learn')
    structure.loadExample(spec.startExample ?? structure.exampleId)
    structure.copyToDesign()
    structure.setDraftTitle(`${spec.title} – ${identity.value.studentId || identity.value.name}`)
    applyLocks()
    persist()
    return null
  }

  function leaveAssignment() {
    mode.value = 'off'
    assignment.value = null
    startedAt.value = ''
    applyLocks()
    persist()
  }

  /** 學生：封緘並下載繳交檔；回傳指紋。 */
  async function submit(): Promise<string | null> {
    const file = assignment.value
    const draft = structure.exportDocument()
    if (!file || !draft) return null
    const submission = await createSubmission(file, identity.value, startedAt.value, draft)
    const text = JSON.stringify(submission)
    lastFingerprint.value = await sha256Hex(text)
    downloadText(`${safeFilename(identity.value.studentId || identity.value.name || 'student')}_${safeFilename(file.assignment.title)}${SUBMISSION_EXT}`, text)
    return lastFingerprint.value
  }

  // ───────── 老師 ─────────
  async function createAndDownload(input: Omit<AssignmentSpec, 'id' | 'createdAt'>, password: string) {
    const { assignmentFile, teacherKeys: keys } = await createAssignment(input)
    const envelope = await encryptWithPassword(JSON.stringify(keys), password)
    downloadText(`${safeFilename(input.title)}${ASSIGNMENT_EXT}`, JSON.stringify(assignmentFile, null, 2))
    downloadText(`${safeFilename(input.title)}-teacher${TEACHER_KEY_EXT}`, JSON.stringify(envelope))
    return assignmentFile
  }

  async function loadTeacherKeys(json: unknown, password: string): Promise<string | null> {
    try {
      const plain = isPasswordEnvelope(json) ? JSON.parse(await decryptWithPassword(json, password)) : json
      if (!isTeacherKeys(plain)) return 'not a teacher key file'
      teacherKeys.value = plain
      mode.value = 'teacher'
      submissions.value = []
      viewing.value = null
      return null
    } catch {
      return 'wrong password or corrupted key file'
    }
  }

  async function addSubmission(fileName: string, json: unknown) {
    if (!teacherKeys.value) return
    const result = await openSubmission(teacherKeys.value, json)
    submissions.value.push(result.ok ? { fileName, result: result.value, error: null } : { fileName, result: null, error: result.error })
  }

  /** 老師：把某份繳交載入檢視（進入設計模式的草稿，可自由查看）。 */
  function viewSubmission(index: number) {
    const s = submissions.value[index]?.result
    if (!s) return
    structure.locks.imports = false
    structure.locks.examples = false
    structure.importDocument(s.payload.draft)
    viewing.value = index
  }

  function exportCsv() {
    const rows = submissions.value
      .filter((s) => s.result)
      .map((s) => {
        const r = s.result!
        const counts = new Map<string, number>()
        for (const a of r.payload.draft.representation.atoms) counts.set(a.element, (counts.get(a.element) ?? 0) + 1)
        return {
          studentId: r.payload.identity.studentId,
          name: r.payload.identity.name,
          submittedAt: r.payload.submittedAt,
          verified: r.verified,
          atoms: r.payload.draft.representation.atoms.length,
          formula: formatFormula([...counts].map(([element, count]) => ({ element, count })), true),
        }
      })
    downloadText(`${safeFilename(teacherKeys.value?.title ?? 'submissions')}-submissions.csv`, submissionsCsv(rows), 'text/csv')
  }

  function closeTeacher() {
    teacherKeys.value = null
    submissions.value = []
    viewing.value = null
    if (mode.value === 'teacher') mode.value = 'off'
  }

  // 重新載入後還原學生的作業階段
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const session = JSON.parse(raw) as StudentSession
      verifyAssignmentFile(session.assignment).then((v) => {
        if (!v.ok) return
        mode.value = 'student'
        assignment.value = v.value
        identity.value = session.identity
        startedAt.value = session.startedAt
        applyLocks()
      })
    }
  } catch {
    /* 忽略損壞的工作階段 */
  }

  return {
    mode,
    assignment,
    identity,
    startedAt,
    lastFingerprint,
    teacherKeys,
    submissions,
    viewing,
    active,
    title,
    inspectAssignment,
    startAssignment,
    leaveAssignment,
    submit,
    createAndDownload,
    loadTeacherKeys,
    addSubmission,
    viewSubmission,
    exportCsv,
    closeTeacher,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useAssignmentStore, import.meta.hot))
