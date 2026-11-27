import { execFile } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import type { THubSnapshot } from '../shared/contracts.ts'
import type { THubRoute } from './hub-route.ts'
import { LocalFixtureError } from './local-test-error.ts'
import { PortlessManager } from './portless.ts'
import { REPO_ROOT } from './services.ts'

const USAGE =
  'Usage: pnpm devhub status | logs <id> | start <id> [chain|related|self] | stop <id> | restart <id> | url <id> | ensure | setup | doctor [--service <id>] [--json]'

const legacyPortOccupied = () =>
  new Promise<boolean>((resolve, reject) => {
    const probe = createServer()
    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(true)
      else reject(error)
    })
    probe.listen({ host: '127.0.0.1', port: 4310, exclusive: true }, () =>
      probe.close(() => resolve(false)),
    )
  })

/** Control existing Hub services; never launch a replacement application process. */
export async function runHubCommand(
  args: string[],
  request: typeof fetch = fetch,
  requestedOrigin = process.env.DEV_HUB_URL,
  routeResolver?: (root: string, directory: string, override?: string) => Promise<THubRoute>,
): Promise<unknown> {
  if (args[0] === 'seed' && (args.length === 1 || args.includes('--help') || args[1] === 'help')) {
    const { SEED_HELP } = await import('./seed-command.ts')
    return SEED_HELP
  }
  if (args[0] === 'env') {
    const { runEnvironmentCommand } = await import('./environment-command.ts')
    return runEnvironmentCommand(args.slice(1), REPO_ROOT)
  }
  if (args[0] === 'db' && ['create', 'migrate', 'status', 'inspect'].includes(args[1])) {
    const rest = args.slice(2)
    if (
      rest.length !== 0 &&
      !(rest.length === 2 && rest[0] === '--target' && ['dev', 'test'].includes(rest[1]))
    )
      throw new Error('Usage: pnpm devhub db create|migrate|status|inspect [--target dev|test]')
    const purpose = (rest[1] || 'dev') as 'dev' | 'test'
    if (args[1] === 'create') {
      const { createManagedDatabase } = await import('./database-create.ts')
      return createManagedDatabase(REPO_ROOT, purpose)
    }
    if (args[1] === 'migrate') {
      const { migrateManagedDatabase } = await import('./database-migrate.ts')
      return migrateManagedDatabase(REPO_ROOT, purpose)
    }
    const { inspectManagedDatabase } = await import('./database-inspect.ts')
    return inspectManagedDatabase(REPO_ROOT, purpose)
  }
  if (args[0] === 'db' && args[1] === 'adopt-primary') {
    const { adoptPrimaryDatabase, parsePrimaryAdoptionOptions } =
      await import('./database-adopt-primary.ts')
    const { purpose, revert } = parsePrimaryAdoptionOptions(args.slice(2))
    return adoptPrimaryDatabase(REPO_ROOT, revert, undefined, undefined, undefined, purpose)
  }
  if (args[0] === 'db' && args[1] === 'drop') {
    if (args.length !== 4 || args[2] !== '--target' || !['dev', 'test'].includes(args[3]))
      throw new Error('Usage: pnpm devhub db drop --target dev|test')
    const { dropManagedDatabase } = await import('./database-drop.ts')
    return dropManagedDatabase(REPO_ROOT, args[3] as 'dev' | 'test')
  }
  if (args[0] === 'setup' && (args.length === 1 || (args.length === 2 && args[1] === '--remove'))) {
    if (
      process.env.CI === 'true' ||
      ['NODE_ENV', 'MIX_ENV', 'ENVIRONMENT', 'CLOUDFLARE_ENV'].some(
        (key) =>
          !['', 'dev', 'development', 'local'].includes(
            process.env[key]?.trim().toLowerCase() || '',
          ),
      )
    )
      throw new Error('Hosts setup is available only for local development.')
    const { resolveCheckout } = await import('./worktree-identity.ts')
    const { readRegisteredState } = await import('./environment-registry.ts')
    const { registryRoot } = await import('./storage-paths.ts')
    const identity = await resolveCheckout(REPO_ROOT)
    const { environment } = await readRegisteredState(registryRoot(), identity)
    if (environment.role === 'secondary') {
      if (!process.stdin.isTTY)
        throw new Error('Sibling hosts setup requires an interactive terminal.')
      const { setupSiblingHosts } = await import('./sibling-hosts.ts')
      const { withPortlessLock } = await import('./portless.ts')
      const { SERVICE_DEFINITIONS } = await import('./services.ts')
      return withPortlessLock(registryRoot(), () =>
        setupSiblingHosts(environment, SERVICE_DEFINITIONS, args[1] === '--remove'),
      )
    }
    if (args[1] === '--remove')
      throw new Error('Primary hosts cannot be removed through the secondary cleanup command.')
  }
  if (args[0] === 'up' || args[0] === 'down' || args[0] === 'foreground') {
    if (args.length > 2 || (args.length === 2 && (args[0] === 'down' || args[1] !== '--full')))
      throw new Error('Usage: pnpm devhub up [--full] | down | foreground [--full]')
    if (
      process.env.CI === 'true' ||
      ['NODE_ENV', 'MIX_ENV', 'ENVIRONMENT', 'CLOUDFLARE_ENV'].some(
        (key) =>
          !['', 'dev', 'development', 'local'].includes(
            process.env[key]?.trim().toLowerCase() || '',
          ),
      )
    ) {
      throw new Error('Managed Hub lifecycle is available only for local development.')
    }
    const { resolveCheckout } = await import('./worktree-identity.ts')
    const { registryRoot, userDataRoot } = await import('./storage-paths.ts')
    const { registerCheckout, readRegisteredRun } = await import('./environment-registry.ts')
    const { upControlOnly, downControlOnly, verifyRunningHub } =
      await import('./control-lifecycle.ts')
    const identity = await resolveCheckout(REPO_ROOT)
    const directory = registryRoot()
    if (args[0] === 'down') {
      await downControlOnly(identity, directory)
      return { stopped: true, repoRoot: identity.root }
    }
    const environment = await registerCheckout(directory, identity)
    const previousRun = await readRegisteredRun(directory, identity)
    let secondaryReady = false
    if (environment.role === 'secondary' && !previousRun && args[1] !== '--full') {
      try {
        const file = JSON.parse(
          await readFile(
            path.join(identity.root, 'local/dev-hub/config/database-target.json'),
            'utf8',
          ),
        )
        secondaryReady = Boolean(file?.targets?.dev && file?.targets?.test)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    const mode =
      environment.role === 'primary' || args[1] === '--full' || secondaryReady
        ? 'full'
        : previousRun?.mode || 'control-only'
    let serviceIds: string[] | undefined
    if (environment.role === 'secondary' && mode === 'full') {
      if (await legacyPortOccupied())
        throw new Error(
          'A legacy Hub is still active on port 4310. Complete its explicit handover before enabling secondary product services.',
        )
      const { verifyManagedDatabase } = await import('./database-ready.ts')
      await verifyManagedDatabase(identity.root, 'dev', directory)
      await verifyManagedDatabase(identity.root, 'test', directory)
      const { SERVICE_DEFINITIONS } = await import('./services.ts')
      serviceIds = SERVICE_DEFINITIONS.filter((service) => service.port).map(
        (service) => service.id,
      )
    }
    if (mode === 'full' && !previousRun) {
      if (environment.role === 'primary') {
        if (await legacyPortOccupied())
          throw new Error(
            'A legacy Hub is running on port 4310. Inspect it and complete an explicit handover before starting a managed Hub.',
          )
      }
      await promisify(execFile)('pnpm', ['--filter', '@groupher/local-dev-hub', 'build'], {
        cwd: REPO_ROOT,
      })
    }
    const started = await upControlOnly(identity, directory, {
      cwd: path.join(REPO_ROOT, 'local/dev-hub'),
      logDirectory: path.join(userDataRoot(identity.root), 'logs'),
      mode,
      serviceIds,
      reuseExisting: args[0] !== 'foreground',
    })
    if (args[0] !== 'foreground') return started
    console.log(`Dev Hub foreground instance is ready at ${started.apiOrigin}.`)
    await new Promise<void>((resolve, reject) => {
      let stopping = false
      let checking = false
      const keepAlive = setInterval(() => {
        if (stopping || checking) return
        checking = true
        verifyRunningHub(identity, directory)
          .then((current) => {
            if (current.instanceId !== started.instanceId)
              throw new Error('Foreground Hub instance has been replaced.')
          })
          .catch((error) => {
            if (stopping) return
            clearInterval(keepAlive)
            process.off('SIGINT', shutdown)
            process.off('SIGTERM', shutdown)
            reject(error)
          })
          .finally(() => {
            checking = false
          })
      }, 2000)
      const shutdown = () => {
        stopping = true
        process.off('SIGINT', shutdown)
        process.off('SIGTERM', shutdown)
        downControlOnly(identity, directory).then(
          () => {
            clearInterval(keepAlive)
            resolve()
          },
          (error) => {
            clearInterval(keepAlive)
            reject(error)
          },
        )
      }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    return { stopped: true, repoRoot: identity.root }
  }
  if (args[0] === 'doctor') {
    const rest = args.slice(1)
    const jsonIndex = rest.indexOf('--json')
    if (jsonIndex !== -1) rest.splice(jsonIndex, 1)
    if (
      rest.length !== 0 &&
      !(rest.length === 2 && rest[0] === '--service' && rest[1] && !rest[1].startsWith('--'))
    )
      throw new Error('Usage: pnpm devhub doctor [--service <id>] [--json]')
    const { diagnoseEnvironment } = await import('./doctor.ts')
    return diagnoseEnvironment(REPO_ROOT, undefined, undefined, rest[1])
  }
  const { resolveHubRoute } = await import('./hub-route.ts')
  const { registryRoot } = await import('./storage-paths.ts')
  const route = await (routeResolver || resolveHubRoute)(REPO_ROOT, registryRoot(), requestedOrigin)
  const origin = route.origin
  if (args[0] === 'seed') {
    const { formatSeedResult, mapSeedCommand } = await import('./seed-command.ts')
    const seedArgs = args.slice(1)
    const result = await runHubCommand(mapSeedCommand(seedArgs), request, origin, routeResolver)
    return seedArgs.includes('--json') ? formatSeedResult(seedArgs, REPO_ROOT, result) : result
  }
  if (['actors', 'communities', 'articles', 'admin', 'case', 'home'].includes(args[0])) {
    const { runLocalTestCommand } = await import('./local-test-command.ts')
    return runLocalTestCommand(
      args,
      () => runHubCommand(['status'], request, origin, routeResolver),
      origin,
    )
  }
  const [action, id, mode, ...extra] = args
  if (!action || extra.length) throw new Error(USAGE)
  if (['ensure', 'setup'].includes(action) && !id) {
    if (route.mode === 'control-only')
      throw new Error('Portless changes are unavailable in control-only mode.')
    await new PortlessManager().ensure(action === 'setup')
    return { ready: true }
  }
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
            headers: {
              'Content-Type': 'application/json',
              ...(route.instanceId ? { 'X-Groupher-Instance-Id': route.instanceId } : {}),
            },
            body: JSON.stringify(body),
          }
        : {}),
      // A start chain can include a cold Phoenix compile plus other dependencies.
      signal: AbortSignal.timeout(
        body ? (action === 'start' || action === 'restart' ? 240_000 : 120_000) : 5_000,
      ),
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

  let identity: {
    repoRoot: string
    instanceId?: string
    mode?: string
    role?: string
    apiVersion?: number
    apiOrigin?: string
  }
  try {
    identity = await call<typeof identity>('/api/identity')
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
  if (
    route.instanceId &&
    (identity.instanceId !== route.instanceId ||
      identity.apiOrigin !== origin ||
      identity.mode !== route.mode ||
      identity.role !== route.role ||
      identity.apiVersion !== 1)
  ) {
    throw new Error('Hub identity does not match this checkout registration.')
  }

  const snapshot = (): Promise<THubSnapshot> => call<THubSnapshot>('/api/services')
  if (action === 'status') {
    return (await snapshot()).services.map(
      ({ id, status, pid, url, portlessAppUrl, portlessUrl }) => ({
        id,
        status,
        pid,
        localUrl: url,
        url: portlessAppUrl || portlessUrl,
      }),
    )
  }
  const service = (await snapshot()).services.find((service) => service.id === id)
  if (!service) throw new Error(`Unknown Dev Hub service: ${id}`)
  if (route.mode === 'control-only') {
    if (action === 'url') {
      const url = service.portlessAppUrl || service.portlessUrl
      if (!url) throw new Error(`${id} has no assigned URL in control-only mode.`)
      return url
    }
    throw new Error('Product service operations are unavailable in control-only mode.')
  }
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
    const args = process.argv.slice(2)
    if (
      args[0] === 'db' &&
      args[1] === 'inspect' &&
      (process.stdin.isTTY || args.includes('--interactive') || args.includes('--sql'))
    ) {
      const { runReadOnlyDatabaseCli } = await import('./database-read-only-cli.ts')
      await runReadOnlyDatabaseCli(REPO_ROOT, args.slice(2))
    } else {
      const result = await runHubCommand(args)
      console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
      if (
        result &&
        typeof result === 'object' &&
        'status' in result &&
        ['partial', 'blocked'].includes(String(result.status))
      )
        process.exitCode = 1
    }
  } catch (error) {
    if (process.argv.includes('--json')) {
      const runIndex = process.argv.indexOf('--run')
      console.error(
        JSON.stringify({
          error: error instanceof LocalFixtureError ? error.code : 'seed_command_failed',
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof LocalFixtureError && error.details
            ? { details: error.details }
            : {}),
          ...(runIndex >= 0 && process.argv[runIndex + 1]
            ? { run: process.argv[runIndex + 1] }
            : {}),
          environment: REPO_ROOT,
        }),
      )
    } else {
      console.error(error instanceof Error ? error.message : error)
    }
    process.exitCode = 1
  }
}
