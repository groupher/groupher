import { access } from 'node:fs/promises'
import path from 'node:path'

import { readRegisteredState } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

export type THubRoute = {
  origin: string
  instanceId: string | null
  mode: 'legacy' | 'control-only' | 'full'
  role: 'primary' | 'secondary'
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Find this checkout's registered Hub without claiming or creating an environment. */
export async function resolveHubRoute(
  repoRoot: string,
  directory: string,
  override?: string,
): Promise<THubRoute> {
  const identity = await resolveCheckout(repoRoot)
  const primaryExists = await exists(path.join(directory, 'primary.json'))
  if (!primaryExists) {
    if (await exists(path.join(directory, 'registry.json')))
      throw new Error('Primary identity is missing; registry recovery is required.')
    if (!identity.isMainWorktree)
      throw new Error(
        'Secondary checkout is not registered; initialize primary and register this checkout first.',
      )
    return {
      origin: override || 'http://127.0.0.1:4310',
      instanceId: null,
      mode: 'legacy',
      role: 'primary',
    }
  }
  const { environment, run } = await readRegisteredState(directory, identity)
  if (!run) {
    if (environment.role === 'primary')
      return {
        origin: override || 'http://127.0.0.1:4310',
        instanceId: null,
        mode: 'legacy',
        role: 'primary',
      }
    throw new Error('No Hub is running for this checkout; use pnpm devhub up.')
  }
  if (run.phase !== 'running') throw new Error('The Hub for this checkout is still starting.')
  const origin = `http://127.0.0.1:${run.port}`
  if (override && override !== origin)
    throw new Error('DEV_HUB_URL conflicts with the registered instance.')
  return { origin, instanceId: run.instanceId, mode: run.mode, role: environment.role }
}
