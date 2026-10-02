import { parseDesignDocument, type DesignDocument } from '../core/design'

/**
 * 設計草稿的本機自動保存（localStorage，只在使用者自己的瀏覽器；不連任何伺服器）。
 * 讀取時一律經過 parseDesignDocument 驗證，壞掉的資料不會進入 store。
 */
const KEY = 'crystalscope_draft_v1'

export function saveDraft(doc: DesignDocument): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc))
    return true
  } catch {
    return false
  }
}

export function loadDraft(): DesignDocument | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = parseDesignDocument(JSON.parse(raw))
    return parsed.ok ? parsed.doc : null
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 無法存取 localStorage（私密模式等）時忽略 */
  }
}
