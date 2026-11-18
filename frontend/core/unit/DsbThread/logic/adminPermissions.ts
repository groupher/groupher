import { GATE_METADATA, type TGateAction } from '@groupher/contracts/gate'

/** Expands selected Community grants to the transitive requirements in the shared Gate catalog. */
export function expandAdminPermissions(selected: string[]): Record<string, boolean> {
  const expanded = new Set<TGateAction>()
  const add = (permission: string) => {
    if (!(permission in GATE_METADATA)) return
    const action = permission as TGateAction
    if (expanded.has(action)) return
    expanded.add(action)
    const metadata = GATE_METADATA[action]
    metadata.requires.forEach(add)
    Object.values(metadata.requiresThread).flat().forEach(add)
  }
  selected.forEach(add)
  return Object.fromEntries([...expanded].map((permission) => [permission, true]))
}
