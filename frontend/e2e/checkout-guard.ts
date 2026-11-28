import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

/** The legacy E2E listeners and Phoenix address are shared machine-wide. */
export function assertLegacyE2ECheckout(repoRoot: string, registryDirectory: string): void {
  const root = realpathSync(repoRoot)
  const primaryFile = path.join(registryDirectory, 'primary.json')
  if (existsSync(primaryFile)) {
    const primary: unknown = JSON.parse(readFileSync(primaryFile, 'utf8'))
    if (
      !primary ||
      typeof primary !== 'object' ||
      !('version' in primary) ||
      primary.version !== 1 ||
      !('root' in primary) ||
      typeof primary.root !== 'string' ||
      primary.root !== root
    ) {
      throw new Error(
        'This E2E runner uses shared ports and the primary Phoenix; secondary checkouts are not supported.',
      )
    }
  } else if (existsSync(path.join(root, '.git')) && statSync(path.join(root, '.git')).isFile()) {
    throw new Error(
      'This E2E runner uses shared ports and the primary Phoenix; linked worktrees are not supported.',
    )
  }
}
