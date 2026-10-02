import type { LatticePointKind } from '../core/centering'

export interface LatticePointKindInfo {
  /** 名稱的訊息鍵。 */
  nameKey: 'kind.corner' | 'kind.base' | 'kind.body' | 'kind.face'
  nameEn: string
  /** 位置說明（分率座標）；面心有多個位置，使用訊息鍵 kind.facePos。 */
  position: string
  color: string
}

/** 晶格點類型的顯示資料；顏色選用在淺色與深色背景皆可辨識的色相。 */
export const LATTICE_POINT_KINDS: Record<LatticePointKind, LatticePointKindInfo> = {
  corner: { nameKey: 'kind.corner', nameEn: 'Corner', position: '(0, 0, 0)', color: '#4f7fe0' },
  base: { nameKey: 'kind.base', nameEn: 'Base centre', position: '(½, ½, 0)', color: '#a35fd6' },
  body: { nameKey: 'kind.body', nameEn: 'Body centre', position: '(½, ½, ½)', color: '#e0803c' },
  face: { nameKey: 'kind.face', nameEn: 'Face centre', position: '', color: '#3fae6a' },
}
