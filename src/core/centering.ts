import type { Vec3 } from './types'

/**
 * 晶格心型（centering）。R 在菱面體軸設定下為簡單晶胞，故以 P 表示，
 * 由資料層的布拉菲符號 hR 標明。
 */
export type Centering = 'P' | 'C' | 'I' | 'F'

/** 晶格點類型：corner 為原點平移（角落），其餘為位於 1/2 位置的心型平移。 */
export type LatticePointKind = 'corner' | 'base' | 'body' | 'face'

export interface CenteringTranslation {
  vector: Vec3
  kind: LatticePointKind
}

const CENTERING_TRANSLATIONS: Record<Centering, CenteringTranslation[]> = {
  P: [{ vector: [0, 0, 0], kind: 'corner' }],
  // 底心：採 C 面（ab 面）設定
  C: [
    { vector: [0, 0, 0], kind: 'corner' },
    { vector: [0.5, 0.5, 0], kind: 'base' },
  ],
  I: [
    { vector: [0, 0, 0], kind: 'corner' },
    { vector: [0.5, 0.5, 0.5], kind: 'body' },
  ],
  F: [
    { vector: [0, 0, 0], kind: 'corner' },
    { vector: [0, 0.5, 0.5], kind: 'face' },
    { vector: [0.5, 0, 0.5], kind: 'face' },
    { vector: [0.5, 0.5, 0], kind: 'face' },
  ],
}

export function centeringTranslations(centering: Centering): CenteringTranslation[] {
  return CENTERING_TRANSLATIONS[centering]
}

/** 每個慣用晶胞所含的晶格點數：P=1、C=2、I=2、F=4。 */
export function latticePointsPerCell(centering: Centering): number {
  return CENTERING_TRANSLATIONS[centering].length
}
