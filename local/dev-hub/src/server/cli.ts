import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { THubSnapshot } from '../shared/contracts.ts'
import { PortlessManager, runPortless } from './portless.ts'
import { REPO_ROOT } from './services.ts'

const USAGE =
  'Usage: pnpm devhub status | logs <id> | start <id> [chain|related|self] | stop <id> | restart <id> | url <id> | ensure | setup | doctor'

/** Control existing Hub services; never launch a replacement application process. */
export async function runHubCommand(
  args: string[],
  request: typeof fetch = fetch,
  origin = process.env.DEV_HUB_URL || 'http://127.0.0.1:4310',
): Promise<unknown> {
  if (['actors', 'communities', 'articles'].includes(args[0])) {
    const { runLocalTestCommand } = await import('./local-test-command.ts')
    return runLocalTestCommand(args, () => runHubCommand(['status'], request, origin), origin)
  }
  const [action, id, mode, ...extra] = args
  if (!action || extra.length) throw new Error(USAGE)
  if (['ensure', 'setup'].includes(action) && !id) {
    await new PortlessManager().ensure(action === 'setup')
    return { ready: true }
  }
  if (action === 'doctor' && !id) return JSON.parse(await runPortless(['doctor', '--json']))
  if (
    !['status', 'logs', 'start', 'stop', 'restart', 'url'].includes(action) ||
    (action === 'status' ? Boolean(id) : !id) ||
    (mode && (action !== 'start' || !['chain', 'related', 'self'].includes(mode)))
  )
    throw new Error(USAGE)

  const call = async <T>(pathname: string, body?: object): Promise<T> => {
    const response = await request(new URL(pathname, origin), {
      ...(body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
      signal: AbortSignal.timeout(body ? 120_000 : 5_000),
    })
    if (!response.ok) {
      throw new Error(`Dev Hub ${pathname}: ${response.status} ${await response.text()}`)
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(
        `Dev Hub ${pathname} did not return JSON. Restart the existing Hub to load the current API.`,
      )
    }
    return response.json()
  }

  let identity: { repoRoot: string }
  try {
    identity = await call<{ repoRoot: string }>('/api/identity')
  } catch (error) {
    throw new Error(
      `Dev Hub is unavailable or needs an update at ${origin}. Start it with make dev (make dev.dev for Hub development); stop an outdated instance from its own terminal or app before restarting. ${error instanceof Error ? error.message : error}`,
    )
  }
  if ((await realpath(identity.repoRoot)) !== (await realpath(REPO_ROOT))) {
    throw new Error(
      `Dev Hub belongs to another worktree: ${identity.repoRoot}. Refusing to control its services.`,
    )
  }

  const snapshot = (): Promise<THubSnapshot> => call<THubSnapshot>('/api/services')
  if (action === 'status') {
    return (await snapshot()).services.map(({ id, status, pid, portlessAppUrl, portlessUrl }) => ({
      id,
      status,
      pid,
      url: portlessAppUrl || portlessUrl,
    }))
  }
  const service = (await snapshot()).services.find((service) => service.id === id)
  if (!service) throw new Error(`Unknown Dev Hub service: ${id}`)
  if (action === 'url') {
    await call('/api/environment/ensure', {})
    const url = service.portlessAppUrl || service.portlessUrl
    if (!url) throw new Error(`${id} has no canonical Portless URL.`)
    return url
  }
  const servicePath = `/api/services/${encodeURIComponent(id!)}`
  if (action === 'logs') return call(`${servicePath}/logs`)
  return call(`${servicePath}/${action}`, action === 'start' && mode ? { mode } : {})
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runHubCommand(process.argv.slice(2))
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      ['partial', 'blocked'].includes(String(result.status))
    )
      process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
