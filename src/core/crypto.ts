/**
 * 純前端密碼學（WebCrypto），不經任何伺服器：
 * - 密碼加密：PBKDF2-SHA256 → AES-GCM-256（草稿檔、老師金鑰檔）。
 * - 簽章：ECDSA P-256 / SHA-256（老師簽題目；學生端與批改端驗章）。
 * - 封緘：臨時 ECDH P-256 + HKDF-SHA256 → AES-GCM-256（學生作業只有老師私鑰能開）。
 * 所有二進位以 base64 存入 JSON。
 */

const subtle = () => globalThis.crypto.subtle
const utf8 = new TextEncoder()
const utf8d = new TextDecoder()

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of u) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))
const buf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

/** 鍵依字母排序的 JSON：簽章與驗章必須對同一字串。 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', utf8.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ───────────── 密碼加密 ─────────────

export const PASSWORD_ENVELOPE_FORMAT = 'crystalscope-encrypted'
const PBKDF2_ITERATIONS = 310_000

export interface PasswordEnvelope {
  format: typeof PASSWORD_ENVELOPE_FORMAT
  v: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export function isPasswordEnvelope(x: unknown): x is PasswordEnvelope {
  const e = x as PasswordEnvelope | null
  return !!e && typeof e === 'object' && e.format === PASSWORD_ENVELOPE_FORMAT && e.v === 1 && typeof e.ciphertext === 'string'
}

async function passwordKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptWithPassword(plaintext: string, password: string): Promise<PasswordEnvelope> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await passwordKey(password, salt, PBKDF2_ITERATIONS)
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, utf8.encode(plaintext))
  return { format: PASSWORD_ENVELOPE_FORMAT, v: 1, kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) }
}

/** 密碼錯誤或內容被竄改時丟出錯誤（AES-GCM 驗證失敗）。 */
export async function decryptWithPassword(envelope: PasswordEnvelope, password: string): Promise<string> {
  const key = await passwordKey(password, fromBase64(envelope.salt), envelope.iterations)
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: buf(fromBase64(envelope.iv)) }, key, buf(fromBase64(envelope.ciphertext)))
  return utf8d.decode(plain)
}

// ───────────── 簽章 ─────────────

export interface KeyPairJwk {
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
}

async function exportPair(pair: CryptoKeyPair): Promise<KeyPairJwk> {
  return { publicJwk: await subtle().exportKey('jwk', pair.publicKey), privateJwk: await subtle().exportKey('jwk', pair.privateKey) }
}

export async function generateSigningKeys(): Promise<KeyPairJwk> {
  return exportPair(await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']))
}

export async function signPayload(privateJwk: JsonWebKey, payload: unknown): Promise<string> {
  const key = await subtle().importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8.encode(canonicalJson(payload)))
  return toBase64(sig)
}

export async function verifyPayload(publicJwk: JsonWebKey, payload: unknown, signature: string): Promise<boolean> {
  try {
    const key = await subtle().importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, buf(fromBase64(signature)), utf8.encode(canonicalJson(payload)))
  } catch {
    return false
  }
}

// ───────────── 封緘（只有收件人能開） ─────────────

export const SEALED_FORMAT = 'crystalscope-sealed'
const HKDF_INFO = utf8.encode('crystalscope-sealed-v1')

export interface SealedEnvelope {
  format: typeof SEALED_FORMAT
  v: 1
  ephemeralPublicJwk: JsonWebKey
  salt: string
  iv: string
  ciphertext: string
}

export async function generateEncryptionKeys(): Promise<KeyPairJwk> {
  return exportPair(await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
}

async function sharedAesKey(privateJwk: JsonWebKey, publicJwk: JsonWebKey, salt: Uint8Array): Promise<CryptoKey> {
  const priv = await subtle().importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const pub = await subtle().importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, priv, 256)
  const hkdf = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: HKDF_INFO }, hkdf, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function sealForRecipient(recipientPublicJwk: JsonWebKey, plaintext: string): Promise<SealedEnvelope> {
  const ephemeral = await generateEncryptionKeys()
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await sharedAesKey(ephemeral.privateJwk, recipientPublicJwk, salt)
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, utf8.encode(plaintext))
  return { format: SEALED_FORMAT, v: 1, ephemeralPublicJwk: ephemeral.publicJwk, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) }
}

/** 金鑰不符或內容被竄改時丟出錯誤。 */
export async function openSealed(recipientPrivateJwk: JsonWebKey, envelope: SealedEnvelope): Promise<string> {
  const key = await sharedAesKey(recipientPrivateJwk, envelope.ephemeralPublicJwk, fromBase64(envelope.salt))
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: buf(fromBase64(envelope.iv)) }, key, buf(fromBase64(envelope.ciphertext)))
  return utf8d.decode(plain)
}

/** 隨機識別碼（作業 id 等）。 */
export function randomId(bytes = 8): string {
  return [...randomBytes(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
