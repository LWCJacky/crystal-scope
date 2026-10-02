import type { LatticePointKind } from '../core/centering'

export interface LatticePointKindInfo {
  nameZh: string
  nameEn: string
  /** 位置說明（分率座標）。 */
  position: string
  color: string
}

/** 晶格點類型的顯示資料；顏色選用在淺色與深色背景皆可辨識的色相。 */
export const LATTICE_POINT_KINDS: Record<LatticePointKind, LatticePointKindInfo> = {
  corner: { nameZh: '角落', nameEn: 'Corner', position: '(0, 0, 0)', color: '#4f7fe0' },
  base: { nameZh: '底心', nameEn: 'Base centre', position: '(½, ½, 0)', color: '#a35fd6' },
  body: { nameZh: '體心', nameEn: 'Body centre', position: '(½, ½, ½)', color: '#e0803c' },
  face: { nameZh: '面心', nameEn: 'Face centre', position: '(0, ½, ½) 等', color: '#3fae6a' },
}
