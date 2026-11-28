import { execFile } from 'node:child_process'
import { lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { verifyRunningHub } from './control-lifecycle.ts'
import { inspectManagedDatabase } from './database-inspect.ts'
import { inspectRegisteredEnvironments, readRegisteredState } from './environment-registry.ts'
import { runPortless } from './portless.ts'
import { SERVICE_DEFINITIONS, type TServiceDefinition } from './services.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout, type TCheckoutIdentity } from './worktree-identity.ts'

type TDoctorDependencies = {
  portless: () => Promise<unknown>
  inspect: typeof inspectManagedDatabase
  services?: (identity: TCheckoutIdentity, directory: string) => Promise<unknown>
}

async function readServices(identity: TCheckoutIdentity, directory: string): Promise<unknown> {
  const verified = await verifyRunningHub(identity, directory)
  const response = await fetch(`${verified.apiOrigin}/api/services`, {
    signal: AbortSignal.timeout(2000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Registered Hub service status is unavailable.')
  const snapshot: unknown = await response.json()
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    !('services' in snapshot) ||
    !Array.isArray(snapshot.services)
  )
    throw new Error('Registered Hub returned an invalid service snapshot.')
  if ((await verifyRunningHub(identity, directory)).instanceId !== verified.instanceId)
    throw new Error('Registered Hub changed while reading service status.')
  return snapshot.services.map((service: Record<string, unknown>) => ({
    id: service.id,
    status: service.status,
    pid: service.pid,
    localUrl: service.appUrl || service.url,
    publicUrl: service.portlessAppUrl || service.portlessUrl,
    unavailableReason: service.unavailableReason,
  }))
}

async function inspectStoragePath(candidate: string) {
  try {
    const info = await lstat(candidate)
    return { path: candidate, state: info.isDirectory() ? 'directory' : 'other' }
  } catch (error) {
    return {
      path: candidate,
      state: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unavailable',
    }
  }
}

/** Summarize the configured start chain against a verified service snapshot. */
export function diagnoseServiceDependencies(
  serviceId: string,
  definitions: readonly TServiceDefinition[],
  snapshot: unknown,
) {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  if (!byId.has(serviceId)) throw new Error(`Unknown service: ${serviceId}`)
  const states = new Map<string, Record<string, unknown>>()
  if (Array.isArray(snapshot)) {
    for (const item of snapshot) {
      if (item && typeof item === 'object' && typeof item.id === 'string') states.set(item.id, item)
    }
  }
  const required = new Set<string>()
  const optional = new Set<string>()
  const visit = (id: string, isOptional: boolean, seen: Set<string>) => {
    const key = `${isOptional ? 'optional' : 'required'}:${id}`
    if (seen.has(key)) return
    seen.add(key)
    const policy = byId.get(id)?.startPolicy
    for (const next of policy?.requiredDependencies || []) {
      if (next !== serviceId) (isOptional ? optional : required).add(next)
      visit(next, isOptional, seen)
    }
    for (const next of policy?.optionalDependencies || []) {
      if (next !== serviceId) optional.add(next)
      visit(next, true, seen)
    }
  }
  visit(serviceId, false, new Set())
  // A dependency reached through both paths is required.
  for (const id of required) optional.delete(id)
  const describe = (id: string) => {
    const state = states.get(id)
    return {
      id,
      status: typeof state?.status === 'string' ? state.status : 'unknown',
      publicUrl: state?.publicUrl ?? null,
      unavailableReason: state?.unavailableReason ?? null,
    }
  }
  const target = describe(serviceId)
  const requiredItems = [...required].map(describe)
  const optionalItems = [...optional].map(describe)
  const needed = [target, ...requiredItems]
  const notReady = needed.filter((item) =>
    ['stopped', 'stopping', 'starting', 'error', 'unavailable'].includes(item.status),
  )
  const unknown = needed.filter(
    (item) => !['running', ...notReady.map((v) => v.status)].includes(item.status),
  )
  const nextSteps = notReady.flatMap((item) => {
    if (item.status === 'unavailable')
      return [`Inspect ${item.id}: ${item.unavailableReason || 'service unavailable'}.`]
    if (item.status === 'starting' || item.status === 'stopping')
      return [`Wait for ${item.id}, then run doctor again.`]
    if (item.status === 'error') return [`Inspect logs: pnpm devhub logs ${item.id}`]
    return [`Start through Hub when appropriate: pnpm devhub start ${item.id}`]
  })
  if (unknown.length)
    nextSteps.push('Verify Hub registration and service ownership before taking action.')
  return {
    target,
    required: requiredItems,
    optional: optionalItems,
    conclusion: {
      status: notReady.length ? 'not-ready' : unknown.length ? 'unknown' : 'running',
      notReady: notReady.map((item) => item.id),
      unknown: unknown.map((item) => item.id),
      optionalNotRunning: optionalItems
        .filter((item) => ['stopped', 'error', 'unavailable'].includes(item.status))
        .map((item) => item.id),
      optionalTransitioning: optionalItems
        .filter((item) => ['starting', 'stopping'].includes(item.status))
        .map((item) => item.id),
      optionalUnknown: optionalItems
        .filter(
          (item) =>
            !['running', 'stopped', 'error', 'unavailable', 'starting', 'stopping'].includes(
              item.status,
            ),
        )
        .map((item) => item.id),
      nextSteps,
    },
    note: 'Service status is a snapshot; it does not verify the complete application workflow.',
  }
}

/** Inspect checkout identity and local dependencies without starting or modifying services. */
export async function diagnoseEnvironment(
  root: string,
  directory = registryRoot(),
  dependencies: TDoctorDependencies = {
    portless: async () => JSON.parse(await runPortless(['doctor', '--json'])),
    inspect: inspectManagedDatabase,
  },
  serviceId?: string,
) {
  const identity = await resolveCheckout(root)
  const issues: Array<{ component: string; message: string }> = []
  const note = (component: string, error: unknown) => {
    issues.push({ component, message: error instanceof Error ? error.message : 'Unavailable.' })
  }
  let head: string | null = null
  try {
    const result = await promisify(execFile)('git', ['-C', identity.root, 'rev-parse', 'HEAD'])
    head = result.stdout.trim()
  } catch (error) {
    note('head', error)
  }
  let registration: {
    slug: string
    role: 'primary' | 'secondary'
    run: null | {
      instanceId: string
      phase: string
      mode: string
      port: number
      servicePorts: Record<string, number>
    }
  } | null = null
  try {
    const { environment, run } = await readRegisteredState(directory, identity)
    registration = {
      slug: environment.slug,
      role: environment.role,
      run: run
        ? {
            instanceId: run.instanceId,
            phase: run.phase,
            mode: run.mode,
            port: run.port,
            servicePorts: run.servicePorts || {},
          }
        : null,
    }
  } catch (error) {
    note('registration', error)
  }
  let environments: unknown = null
  try {
    environments = await Promise.all(
      (await inspectRegisteredEnvironments(directory)).map(async (environment) => {
        const base = path.join(directory, environment.worktreeId)
        const baseStatus = await inspectStoragePath(base)
        const child = (name: string) =>
          baseStatus.state === 'directory'
            ? inspectStoragePath(path.join(base, name))
            : Promise.resolve({
                path: path.join(base, name),
                state: baseStatus.state === 'missing' ? 'missing' : 'unverified-parent',
              })
        return {
          ...environment,
          storage: {
            root: baseStatus,
            browsers: await child('browsers'),
            metrics: await child('metrics'),
            workerState: await child('worker-state'),
            workerRuntime: await inspectStoragePath(
              path.join(tmpdir(), 'groupher-dev-hub', environment.worktreeId, 'workers'),
            ),
          },
        }
      }),
    )
  } catch (error) {
    note('environment-inventory', error)
  }
  const databases: Record<string, unknown> = {}
  if (registration) {
    for (const purpose of ['dev', 'test'] as const) {
      try {
        const database = await dependencies.inspect(identity.root, purpose, directory)
        databases[purpose] = {
          target: database.target,
          applied: database.migrationCount,
          pending: database.pending,
          unknown: database.unknown,
        }
      } catch (error) {
        note(`database:${purpose}`, error)
        databases[purpose] = null
      }
    }
  }
  let services: unknown = null
  if (registration?.run?.phase === 'running') {
    try {
      services = await (dependencies.services || readServices)(identity, directory)
    } catch (error) {
      note('services', error)
    }
  }
  let portless: unknown = null
  try {
    portless = await dependencies.portless()
  } catch (error) {
    note('portless', error)
  }
  return {
    checkout: { root: identity.root, worktreeId: identity.worktreeId, head },
    registration,
    environments,
    databases,
    services,
    ...(serviceId
      ? {
          serviceDependencies: diagnoseServiceDependencies(
            serviceId,
            SERVICE_DEFINITIONS,
            services,
          ),
        }
      : {}),
    portless,
    issues,
  }
}
