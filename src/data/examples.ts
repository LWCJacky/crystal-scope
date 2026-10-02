import { CRYSTAL_SYSTEMS } from './crystalSystems'
import { MATERIALS } from './materials'
import type { StructureExample } from './types'

export const ALL_EXAMPLES: StructureExample[] = [...CRYSTAL_SYSTEMS, ...MATERIALS]

export function findExample(id: string): StructureExample {
  const found = ALL_EXAMPLES.find((e) => e.id === id)
  if (!found) throw new Error(`Unknown structure example: ${id}`)
  return found
}
