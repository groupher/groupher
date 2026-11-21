import { GATE_PERMISSION, type TGateAction } from '@groupher/contracts/gate'

/** Expands selected Community grants to the transitive requirements in the shared Gate catalog. */
export function expandAdminPermissions(selected: string[]): Record<string, boolean> {
  const expanded = new Set<TGateAction>()
  const add = (permission: string) => {
    if (!Object.hasOwn(GATE_PERMISSION, permission)) return
    const action = permission as TGateAction
    if (expanded.has(action)) return
    const metadata = GATE_PERMISSION[action]
    if (metadata.scope !== 'community' || !metadata.grantable) return
    expanded.add(action)
    metadata.requires.forEach(add)
  }
  selected.forEach(add)
  return Object.fromEntries([...expanded].map((permission) => [permission, true]))
}
