import { describe, expect, it } from 'vitest'
import { createAssignment, createSubmission, openSubmission, verifyAssignmentFile } from '../assignment'
import { canonicalJson, decryptWithPassword, encryptWithPassword, generateEncryptionKeys, generateSigningKeys, openSealed, sealForRecipient, sha256Hex, signPayload, verifyPayload } from '../crypto'
import type { DesignDocument } from '../design'

const draft: DesignDocument = {
  format: 'crystalscope-draft',
  schemaVersion: 1,
  id: 'd1',
  title: 'HW',
  cell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 },
  lengthUnit: 'angstrom',
  cellSetting: 'conventional',
  representation: { kind: 'cellSites', atoms: [{ id: 'x1', element: 'Cu', fractionalPosition: [0, 0, 0] }] },
  geometryConstraint: 'free',
  neighborRules: [],
  scientificStatus: 'custom-unverified',
}

describe('密碼加密（草稿／老師金鑰）', () => {
  it('往返一致；錯誤密碼與竄改都失敗', async () => {
    const env = await encryptWithPassword('秘密內容 ✓', 'pw-1234')
    expect(await decryptWithPassword(env, 'pw-1234')).toBe('秘密內容 ✓')
    await expect(decryptWithPassword(env, 'wrong')).rejects.toBeDefined()
    const tampered = { ...env, ciphertext: env.ciphertext.slice(0, -4) + 'AAAA' }
    await expect(decryptWithPassword(tampered, 'pw-1234')).rejects.toBeDefined()
  })
})

describe('簽章與封緘', () => {
  it('canonicalJson 與鍵順序無關', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}')
  })
  it('簽章驗證通過；內容改一個字就失敗', async () => {
    const k = await generateSigningKeys()
    const sig = await signPayload(k.privateJwk, { title: 'HW1', n: 1 })
    expect(await verifyPayload(k.publicJwk, { n: 1, title: 'HW1' }, sig)).toBe(true)
    expect(await verifyPayload(k.publicJwk, { n: 2, title: 'HW1' }, sig)).toBe(false)
  })
  it('封緘只有收件人私鑰能開', async () => {
    const teacher = await generateEncryptionKeys()
    const other = await generateEncryptionKeys()
    const env = await sealForRecipient(teacher.publicJwk, 'student work')
    expect(await openSealed(teacher.privateJwk, env)).toBe('student work')
    await expect(openSealed(other.privateJwk, env)).rejects.toBeDefined()
  })
  it('sha256 指紋', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('作業流程', () => {
  it('建立題目 → 驗章 → 學生封緘繳交 → 老師開啟並確認是自己發的', async () => {
    const { assignmentFile, teacherKeys } = await createAssignment({ title: 'HW1', instructions: 'Build FCC', startExample: 'fcc-cu', lockExamples: true, requireStudentId: true, requireName: true })
    const verified = await verifyAssignmentFile(JSON.parse(JSON.stringify(assignmentFile)))
    expect(verified.ok).toBe(true)
    const submission = await createSubmission(assignmentFile, { studentId: 'S001', name: 'Amy' }, '2026-10-03T00:00:00Z', draft)
    expect(submission.assignmentId).toBe(assignmentFile.assignment.id)
    expect(JSON.stringify(submission)).not.toContain('Build FCC')
    const opened = await openSubmission(teacherKeys, JSON.parse(JSON.stringify(submission)))
    expect(opened.ok).toBe(true)
    if (opened.ok) {
      expect(opened.value.verified).toBe(true)
      expect(opened.value.payload.identity.studentId).toBe('S001')
      expect(opened.value.payload.draft.representation.atoms).toHaveLength(1)
    }
  })
  it('竄改過的題目驗章失敗；別的老師的金鑰打不開、或驗不出是自己發的', async () => {
    const { assignmentFile, teacherKeys } = await createAssignment({ title: 'HW1', instructions: 'x', startExample: null, lockExamples: false, requireStudentId: true, requireName: false })
    const tampered = { ...assignmentFile, assignment: { ...assignmentFile.assignment, title: 'HW1 (edited)' } }
    expect((await verifyAssignmentFile(tampered)).ok).toBe(false)
    const other = await createAssignment({ title: 'HW2', instructions: 'y', startExample: null, lockExamples: false, requireStudentId: true, requireName: false })
    const submission = await createSubmission(assignmentFile, { studentId: 'S2', name: '' }, '2026-10-03T00:00:00Z', draft)
    const wrongKey = await openSubmission(other.teacherKeys, submission)
    expect(wrongKey.ok).toBe(false)
    // 用自己的加密金鑰、但題目 id 不同（例如把舊金鑰檔的 id 改掉）→ 開得了但 verified=false
    const mismatched = await openSubmission({ ...teacherKeys, assignmentId: 'another' }, submission)
    expect(mismatched.ok && !mismatched.value.verified).toBe(true)
  })
})
