/**
 * 交易式復原歷史：每個一次性操作（新增／刪除／換元素／換晶胞…）是一筆完整交易；
 * 連續操作（滑桿拖曳、輸入框編輯）以 begin()／end() 包起來，整段只佔一步。
 * 純 TypeScript，不依賴 Vue；快照由呼叫端提供（深複製後的純物件）。
 */
export class EditHistory<S> {
  private past: S[] = []
  private future: S[] = []
  private open = false
  /** 每次變動遞增，供響應式層觀察。 */
  version = 0
  private readonly limit: number

  constructor(limit = 100) {
    this.limit = limit
  }

  /** 一次性交易：記錄變動前的快照。 */
  record(snapshot: S) {
    this.past.push(snapshot)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
    this.version++
  }

  /** 開始一段連續操作；已開啟時不重複記錄。 */
  begin(snapshot: S) {
    if (this.open) return
    this.open = true
    this.record(snapshot)
  }

  end() {
    this.open = false
  }

  get inTransaction() {
    return this.open
  }

  /** 傳入目前狀態，回傳要還原的狀態；沒有歷史時回傳 null。 */
  undo(current: S): S | null {
    const prev = this.past.pop()
    if (prev === undefined) return null
    this.future.push(current)
    this.open = false
    this.version++
    return prev
  }

  redo(current: S): S | null {
    const next = this.future.pop()
    if (next === undefined) return null
    this.past.push(current)
    this.open = false
    this.version++
    return next
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }

  clear() {
    this.past = []
    this.future = []
    this.open = false
    this.version++
  }
}
