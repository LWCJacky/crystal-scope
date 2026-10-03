import { parseDesignDocument, type DesignDocument } from './design'
import { generateEncryptionKeys, generateSigningKeys, openSealed, randomId, sealForRecipient, signPayload, verifyPayload, type SealedEnvelope } from './crypto'

/**
 * 作業模式的檔案格式（規格外的延伸；全部純前端）：
 * - 題目 .csassign：老師公開的作業定義＋老師公鑰（驗章、加密）＋老師私鑰簽章。
 * - 老師金鑰 .cskey：私鑰（以密碼加密後存檔，見 crypto.encryptWithPassword）。
 * - 繳交 .cssubmit：學生作業以老師的加密公鑰封緘，只有老師私鑰能開；內附題目與其簽章供批改端驗證。
 *
 * 能保證：作業只有老師可讀、題目與繳交檔未被竄改、每份繳交綁定到特定題目。
 * 不保證：學生是本人動手——身分欄位是自填的，網站是開源的。
 */
export const ASSIGNMENT_FORMAT = 'crystalscope-assignment'
export const TEACHER_KEY_FORMAT = 'crystalscope-teacher-key'
export const SUBMISSION_FORMAT = 'crystalscope-submission'
export const ASSIGNMENT_EXT = '.csassign'
export const TEACHER_KEY_EXT = '.cskey'
export const SUBMISSION_EXT = '.cssubmit'

export interface AssignmentSpec {
  id: string
  title: string
  instructions: string
  createdAt: string
  /** 作業開始時載入的範例；null 表示沿用學生目前的範例。 */
  startExample: string | null
  /** 作業期間鎖定範例切換（只能在起始範例上編輯）。 */
  lockExamples: boolean
  requireStudentId: boolean
  requireName: boolean
}

export interface AssignmentFile {
  format: typeof ASSIGNMENT_FORMAT
  schemaVersion: 1
  assignment: AssignmentSpec
  teacher: { signPublicJwk: JsonWebKey; encryptPublicJwk: JsonWebKey }
  /** 老師簽章，簽的是 canonicalJson({ assignment, teacher })。 */
  signature: string
}

export interface TeacherKeys {
  format: typeof TEACHER_KEY_FORMAT
  schemaVersion: 1
  assignmentId: string
  title: string
  createdAt: string
  signPrivateJwk: JsonWebKey
  signPublicJwk: JsonWebKey
  encryptPrivateJwk: JsonWebKey
  encryptPublicJwk: JsonWebKey
}

export interface SubmissionIdentity {
  studentId: string
  name: string
}

export interface SubmissionPayload {
  assignment: AssignmentFile
  identity: SubmissionIdentity
  startedAt: string
  submittedAt: string
  draft: DesignDocument
}

export interface SubmissionFile {
  format: typeof SUBMISSION_FORMAT
  schemaVersion: 1
  assignmentId: string
  studentId: string
  submittedAt: string
  envelope: SealedEnvelope
}

export type Verified<T> = { ok: true; value: T } | { ok: false; error: string }

export async function createAssignment(input: Omit<AssignmentSpec, 'id' | 'createdAt'>, now = new Date()): Promise<{ assignmentFile: AssignmentFile; teacherKeys: TeacherKeys }> {
  const sign = await generateSigningKeys()
  const enc = await generateEncryptionKeys()
  const assignment: AssignmentSpec = { ...input, id: randomId(), createdAt: now.toISOString() }
  const teacher = { signPublicJwk: sign.publicJwk, encryptPublicJwk: enc.publicJwk }
  const signature = await signPayload(sign.privateJwk, { assignment, teacher })
  return {
    assignmentFile: { format: ASSIGNMENT_FORMAT, schemaVersion: 1, assignment, teacher, signature },
    teacherKeys: {
      format: TEACHER_KEY_FORMAT,
      schemaVersion: 1,
      assignmentId: assignment.id,
      title: assignment.title,
      createdAt: assignment.createdAt,
      signPrivateJwk: sign.privateJwk,
      signPublicJwk: sign.publicJwk,
      encryptPrivateJwk: enc.privateJwk,
      encryptPublicJwk: enc.publicJwk,
    },
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string'

/** 驗證題目檔的結構與簽章（用檔內的公鑰：證明未被竄改；老師身分由發布管道確認）。 */
export async function verifyAssignmentFile(input: unknown): Promise<Verified<AssignmentFile>> {
  const f = input as AssignmentFile | null
  if (!f || typeof f !== 'object' || f.format !== ASSIGNMENT_FORMAT) return { ok: false, error: 'not an assignment file' }
  if (f.schemaVersion !== 1) return { ok: false, error: `unsupported schemaVersion: ${String(f.schemaVersion)}` }
  const a = f.assignment
  if (!a || !isStr(a.id) || !isStr(a.title) || !isStr(a.instructions) || !isStr(a.createdAt)) return { ok: false, error: 'assignment fields missing' }
  if (a.startExample !== null && !isStr(a.startExample)) return { ok: false, error: 'startExample must be a string or null' }
  if (!f.teacher?.signPublicJwk || !f.teacher?.encryptPublicJwk || !isStr(f.signature)) return { ok: false, error: 'teacher keys or signature missing' }
  const valid = await verifyPayload(f.teacher.signPublicJwk, { assignment: a, teacher: f.teacher }, f.signature)
  if (!valid) return { ok: false, error: 'signature does not match: the file was modified or is not a CrystalScope assignment' }
  return { ok: true, value: f }
}

export function isTeacherKeys(input: unknown): input is TeacherKeys {
  const k = input as TeacherKeys | null
  return !!k && typeof k === 'object' && k.format === TEACHER_KEY_FORMAT && k.schemaVersion === 1 && !!k.signPrivateJwk && !!k.encryptPrivateJwk && isStr(k.assignmentId)
}

export async function createSubmission(assignment: AssignmentFile, identity: SubmissionIdentity, startedAt: string, draft: DesignDocument, now = new Date()): Promise<SubmissionFile> {
  const payload: SubmissionPayload = { assignment, identity, startedAt, submittedAt: now.toISOString(), draft }
  const envelope = await sealForRecipient(assignment.teacher.encryptPublicJwk, JSON.stringify(payload))
  return { format: SUBMISSION_FORMAT, schemaVersion: 1, assignmentId: assignment.assignment.id, studentId: identity.studentId, submittedAt: payload.submittedAt, envelope }
}

export interface OpenedSubmission {
  payload: SubmissionPayload
  /** 題目簽章以老師自己的公鑰驗證通過，且題目 id 與金鑰檔一致：確實是這位老師發布的題目。 */
  verified: boolean
  verifyNote: string
}

/** 老師端：以私鑰開啟繳交檔，並驗證其中的題目確實出自自己。 */
export async function openSubmission(keys: TeacherKeys, input: unknown): Promise<Verified<OpenedSubmission>> {
  const f = input as SubmissionFile | null
  if (!f || typeof f !== 'object' || f.format !== SUBMISSION_FORMAT) return { ok: false, error: 'not a submission file' }
  if (f.schemaVersion !== 1 || !f.envelope) return { ok: false, error: 'unsupported submission file' }
  let text: string
  try {
    text = await openSealed(keys.encryptPrivateJwk, f.envelope)
  } catch {
    return { ok: false, error: 'cannot decrypt: this submission was not sealed for this key' }
  }
  let payload: SubmissionPayload
  try {
    payload = JSON.parse(text)
  } catch {
    return { ok: false, error: 'corrupted submission payload' }
  }
  const draft = parseDesignDocument(payload.draft)
  if (!draft.ok) return { ok: false, error: `invalid draft inside submission: ${draft.error}` }
  payload.draft = draft.doc
  const sameId = payload.assignment?.assignment?.id === keys.assignmentId && f.assignmentId === keys.assignmentId
  const sigOk = !!payload.assignment && (await verifyPayload(keys.signPublicJwk, { assignment: payload.assignment.assignment, teacher: payload.assignment.teacher }, payload.assignment.signature))
  const verified = sameId && sigOk
  const verifyNote = verified ? 'assignment signature valid' : !sameId ? 'assignment id does not match this key file' : 'assignment signature was not made with this key'
  return { ok: true, value: { payload, verified, verifyNote } }
}

/** 批改名單的 CSV（學號、姓名、繳交時間、題目驗證、原子數、組成）。 */
export function submissionsCsv(rows: { studentId: string; name: string; submittedAt: string; verified: boolean; atoms: number; formula: string }[]): string {
  const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`
  const header = ['studentId', 'name', 'submittedAt', 'assignmentVerified', 'atoms', 'formula']
  return [header.join(','), ...rows.map((r) => [r.studentId, r.name, r.submittedAt, r.verified, r.atoms, r.formula].map(esc).join(','))].join('\n')
}
