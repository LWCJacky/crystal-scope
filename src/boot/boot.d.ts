export type BootStage = 'script' | 'init' | 'webgl' | 'frame'
export type BootStatus = 'loading' | 'slow' | 'stalled' | 'error' | 'ready'
export type Locale = 'zh-TW' | 'en' | 'ja'

export const STAGES: Record<BootStage, [number, number]>
export const TIMING: {
  slowMs: number
  stallMs: number
  timeoutMs: number
  minShowMs: number
  skipIfReadyMs: number
  retryDelays: number[]
  crawlTau: number
  crawlCap: number
}

export interface MachineState {
  status: BootStatus
  stage: BootStage
  fraction: number
  determinate: boolean
  bytes: { loaded: number; total: number | null }
  error: { code: string; detail?: string } | null
  attempts: number
  startedAt: number
  lastProgressAt: number
}

export interface Machine {
  state: MachineState
  bytes(loaded: number, total: number | null): void
  report(stage: BootStage, fraction?: number): void
  ready(): void
  fail(code: string, detail?: string): void
  tick(): BootStatus
  retryDelay(): number | null
  restart(): void
}

export function createMachine(now?: () => number): Machine
export function honeycomb(rings: number, size: number): { q: number; r: number; ring: number; x: number; y: number }[]
export function hexagonPoints(cx: number, cy: number, size: number): [number, number][]
export function revealCount(fraction: number, total: number): number
export function detectLocale(cookie: string, languages: readonly string[]): Locale
export const MESSAGES: Record<Locale, { title: string; stages: Record<BootStage, string>; loading: string; slow: string; stalled: string; retry: string; reload: string; retrying: string; issues: string; errors: Record<string, string> }>
export function mount(doc: Document, win: Window & typeof globalThis): unknown
