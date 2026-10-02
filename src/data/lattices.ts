import type { BravaisLattice } from './types'

export const P = (family: string): BravaisLattice => ({ symbol: `${family}P`, centering: 'P', nameKey: 'lattice.P', nameEn: 'Primitive' })
export const C = (family: string): BravaisLattice => ({ symbol: `${family}C`, centering: 'C', nameKey: 'lattice.C', nameEn: 'Base-centred' })
export const I = (family: string): BravaisLattice => ({ symbol: `${family}I`, centering: 'I', nameKey: 'lattice.I', nameEn: 'Body-centred' })
export const F = (family: string): BravaisLattice => ({ symbol: `${family}F`, centering: 'F', nameKey: 'lattice.F', nameEn: 'Face-centred' })
