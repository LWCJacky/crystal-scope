import type { BasisAtom, CellParams } from './types'

/**
 * 設計模式草稿的中繼資料。草稿由正式教學範例「深複製」而來：
 * 任何修改都不回寫教學資料；來源只保留供追溯，不代表草稿現況。
 */
export interface DraftProvenance {
  exampleId: string
  /** 複製時的資料版本（應用程式版本）。 */
  sourceRevision: string
  /** ISO 8601 時間。 */
  copiedAt: string
}

export interface DraftMeta {
  /** 使用者可改的名稱；預設「未命名結構」由介面依語言顯示（null）。 */
  title: string | null
  provenance: DraftProvenance | null
  /** 自由編排成功不表示材料真實存在或結構穩定。 */
  scientificStatus: 'custom-unverified'
}

export function createDraftMeta(exampleId: string, sourceRevision: string, now: Date = new Date()): DraftMeta {
  return {
    title: null,
    provenance: { exampleId, sourceRevision, copiedAt: now.toISOString() },
    scientificStatus: 'custom-unverified',
  }
}

/** 深複製結構資料；回傳物件與來源完全不共用參考。 */
export function copyStructure<P extends Record<string, number>>(cell: CellParams, basis: readonly BasisAtom[], params: P): { cell: CellParams; basis: BasisAtom[]; params: P } {
  return structuredClone({ cell, basis: basis as BasisAtom[], params })
}
