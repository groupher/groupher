import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { databaseTargetForEnvironment } from './database-ownership.ts'
import {
  markRunReady,
  readRegisteredRun,
  readRegisteredState,
  releaseRun,
  reserveRun,
  verifyStoppedRun,
  type TEnvironment,
  type TRun,
} from './environment-registry.ts'
import {
  ISOLATED_CORE_SERVICE_IDS,
  isolatedServiceDefinitions,
} from './isolated-service-definitions.ts'
import { PortlessManager } from './portless.ts'
import { SERVICE_DEFINITIONS } from './services.ts'
import type { TCheckoutIdentity } from './worktree-identity.ts'

const execFileAsync = promisify(execFile)
type TRemoteIdentity = {
  repoRoot: string
  apiOrigin: string
  instanceId: string
  role: string
  mode: string
  apiVersion: number
}

async function processStartTime(pid: number): Promise<string> {
  const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)])
  const time = Date.parse(stdout.trim())
  if (!Number.isFinite(time)) throw new Error('Cannot verify the Hub process start time.')
  return new Date(time).toISOString()
}

async function remoteIdentity(
  port: number,
  identity: TCheckoutIdentity,
  instanceId: string,
  mode: 'full' | 'control-only',
  role: 'primary' | 'secondary',
): Promise<TRemoteIdentity> {
  const origin = `http://127.0.0.1:${port}`
  const response = await fetch(`${origin}/api/identity`, {
    signal: AbortSignal.timeout(1000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Hub identity endpoint is unavailable.')
  const remote = (await response.json()) as TRemoteIdentity
  if (
    remote.repoRoot !== identity.root ||
    remote.apiOrigin !== origin ||
    remote.instanceId !== instanceId ||
    remote.apiVersion !== 1 ||
    remote.mode !== mode ||
    remote.role !== role
  )
    throw new Error('Hub identity does not match its reservation.')
  return remote
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type TAliasCleanup = (environment: TEnvironment, run: TRun, directory: string) => Promise<void>

const cleanupAliases: TAliasCleanup = async (environment, run, directory) => {
  if (environment.role !== 'secondary' || run.mode !== 'full') return
  if (!run.servicePorts) throw new Error('Cannot verify ownership of the missing service ports.')
  const definitions = isolatedServiceDefinitions(
    SERVICE_DEFINITIONS,
    environment.slug,
    run.servicePorts,
    databaseTargetForEnvironment(environment, 'dev'),
  ).filter((service) => ISOLATED_CORE_SERVICE_IDS.has(service.id) && service.command)
  await new PortlessManager(definitions, undefined, directory).removeOwnedAliases()
}

async function finishStoppedRun(
  directory: string,
  identity: TCheckoutIdentity,
  environment: TEnvironment,
  run: TRun,
  cleanup: TAliasCleanup,
): Promise<void> {
  const deadline = Date.now() + 10_000
  while (true) {
    try {
      await verifyStoppedRun(directory, identity, run.instanceId)
      break
    } catch (error) {
      if (Date.now() >= deadline)
        throw new Error('Hub has not fully exited; its run record was retained.', { cause: error })
      await delay(50)
    }
  }
  await cleanup(environment, run, directory)
  await releaseRun(directory, identity, run.instanceId)
}

/** Verify the registered running process and the identity served at its recorded port. */
export async function verifyRunningHub(
  identity: TCheckoutIdentity,
  directory: string,
): Promise<TRemoteIdentity> {
  const { environment, run } = await readRegisteredState(directory, identity)
  if (!run || run.phase !== 'running' || !run.pid || !run.processStartedAt)
    throw new Error('No running Hub with verified process identity is registered.')
  if ((await processStartTime(run.pid)) !== run.processStartedAt)
    throw new Error('Registered Hub process identity no longer matches.')
  return remoteIdentity(run.port, identity, run.instanceId, run.mode, environment.role)
}

/** Start a registered control-only Hub and return after its identity is verified. */
export async function upControlOnly(
  identity: TCheckoutIdentity,
  directory: string,
  options: {
    entryPath?: string
    cwd: string
    logDirectory: string
    ports?: number[]
    timeoutMs?: number
    mode?: 'full' | 'control-only'
    reuseExisting?: boolean
    serviceIds?: string[]
    cleanupAliases?: TAliasCleanup
  },
): Promise<TRemoteIdentity> {
  const existing = await readRegisteredRun(directory, identity)
  if (existing && options.reuseExisting === false)
    throw new Error('A Hub instance is already registered; stop it before foreground startup.')
  if (existing?.phase === 'running') {
    if (
      !existing.pid ||
      !existing.processStartedAt ||
      (await processStartTime(existing.pid)) !== existing.processStartedAt
    )
      throw new Error('Registered Hub process identity no longer matches.')
    if (existing.mode !== (options.mode ?? 'control-only'))
      throw new Error('Registered Hub mode differs from requested mode.')
    return verifyRunningHub(identity, directory)
  }
  const timeoutMs = options.timeoutMs ?? 30_000
  const { environment } = await readRegisteredState(directory, identity)
  const run = await reserveRun(directory, identity, {
    ports: options.ports,
    timeoutMs,
    mode: options.mode,
    serviceIds: options.serviceIds,
  })
  let child: ChildProcess | undefined
  try {
    await mkdir(options.logDirectory, { recursive: true, mode: 0o700 })
    const log = await open(path.join(options.logDirectory, 'hub.log'), 'a', 0o600)
    try {
      child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          options.entryPath ||
            fileURLToPath(
              new URL(
                options.mode === 'full' ? './index.ts' : './control-only-entry.ts',
                import.meta.url,
              ),
            ),
        ],
        {
          cwd: options.cwd,
          detached: true,
          stdio: ['ignore', log.fd, log.fd],
          env: {
            ...process.env,
            DEV_HUB_INSTANCE_ID: run.instanceId,
            DEV_HUB_PORT: String(run.port),
            DEV_HUB_OPEN_BROWSER: 'false',
          },
        },
      )
    } finally {
      await log.close()
    }
    if (!child.pid) throw new Error('Hub process could not be started.')
    const pid = child.pid
    const startedAt = await processStartTime(pid)
    let identityResponse: TRemoteIdentity | undefined
    let lastError: unknown
    while (
      Date.now() < Date.parse(run.deadline) &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      try {
        identityResponse = await remoteIdentity(
          run.port,
          identity,
          run.instanceId,
          run.mode,
          environment.role,
        )
        break
      } catch (error) {
        lastError = error
        await delay(50)
      }
    }
    if (!identityResponse)
      throw new Error('Hub did not become ready before the startup deadline.', { cause: lastError })
    await markRunReady(directory, identity, run.instanceId, pid, startedAt)
    child.unref()
    return identityResponse
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      const until = Date.now() + 2000
      while (child.exitCode === null && child.signalCode === null && Date.now() < until)
        await delay(25)
    }
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      try {
        await finishStoppedRun(
          directory,
          identity,
          environment,
          run,
          options.cleanupAliases || cleanupAliases,
        )
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Hub startup failed; its reservation was retained for cleanup.',
        )
      }
    }
    throw error
  }
}

/** Ask only the verified instance to stop, then release its completed run record. */
export async function downControlOnly(
  identity: TCheckoutIdentity,
  directory: string,
  cleanup: TAliasCleanup = cleanupAliases,
): Promise<void> {
  const { environment, run } = await readRegisteredState(directory, identity)
  if (!run || run.phase !== 'running' || !run.pid || !run.processStartedAt)
    throw new Error('No running Hub with verified process identity is registered.')
  let alive = true
  try {
    process.kill(run.pid, 0)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    alive = false
  }
  if (!alive) {
    await finishStoppedRun(directory, identity, environment, run, cleanup)
    return
  }
  if ((await processStartTime(run.pid)) !== run.processStartedAt)
    throw new Error('Registered Hub process identity no longer matches.')
  const remote = await remoteIdentity(
    run.port,
    identity,
    run.instanceId,
    run.mode,
    environment.role,
  )
  const response = await fetch(`${remote.apiOrigin}/api/shutdown`, {
    method: 'POST',
    headers: { 'x-groupher-instance-id': run.instanceId },
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Verified Hub refused shutdown.')
  await finishStoppedRun(directory, identity, environment, run, cleanup)
}
