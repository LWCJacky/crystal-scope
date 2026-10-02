import type { BravaisLattice } from './types'

export const P = (family: string): BravaisLattice => ({ symbol: `${family}P`, centering: 'P', nameZh: '簡單', nameEn: 'Primitive' })
export const C = (family: string): BravaisLattice => ({ symbol: `${family}C`, centering: 'C', nameZh: '底心', nameEn: 'Base-centred' })
export const I = (family: string): BravaisLattice => ({ symbol: `${family}I`, centering: 'I', nameZh: '體心', nameEn: 'Body-centred' })
export const F = (family: string): BravaisLattice => ({ symbol: `${family}F`, centering: 'F', nameZh: '面心', nameEn: 'Face-centred' })
