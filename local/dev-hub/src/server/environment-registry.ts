import { randomUUID } from 'node:crypto'
import { access, chmod, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'

import { createCheckoutClaim, verifyCheckoutClaim } from './checkout-claim.ts'
import { checkoutSlug, resolveCheckout, type TCheckoutIdentity } from './worktree-identity.ts'

export type TEnvironment = {
  root: string
  commonDir: string
  worktreeId: string
  claimToken: string
  slug: string
  role: 'primary' | 'secondary'
  createdAt: string
}

export type TRun = {
  instanceId: string
  port: number
  phase: 'starting' | 'running'
  mode: 'full' | 'control-only'
  starterPid: number
  deadline: string
  pid?: number
  processStartedAt?: string
  retiredPorts?: number[]
  servicePorts?: Record<string, number>
}

export type TRegistry = { version: 1; environments: TEnvironment[]; runs: Record<string, TRun> }
type TPrimary = { version: 1; root: string; commonDir: string; claimToken: string }

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Expected a JSON object.')
    return value as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error(`Cannot read ${file}; preserve it for diagnosis.`, { cause: error })
  }
}

function validateRegistry(registry: TRegistry): void {
  if (
    registry.version !== 1 ||
    !Array.isArray(registry.environments) ||
    !registry.runs ||
    typeof registry.runs !== 'object' ||
    Array.isArray(registry.runs)
  )
    throw new Error('Invalid registry; preserve it for diagnosis.')

  const roots = new Set<string>()
  const slugs = new Set<string>()
  const ids = new Set<string>()
  let primaryCount = 0
  for (const environment of registry.environments) {
    if (
      !environment ||
      typeof environment !== 'object' ||
      typeof environment.root !== 'string' ||
      !path.isAbsolute(environment.root) ||
      typeof environment.commonDir !== 'string' ||
      !path.isAbsolute(environment.commonDir) ||
      !/^[a-f0-9]{16}$/.test(environment.worktreeId) ||
      !/^[a-f0-9]{64}$/.test(environment.claimToken) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(environment.slug) ||
      !['primary', 'secondary'].includes(environment.role) ||
      typeof environment.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(environment.createdAt))
    ) {
      throw new Error('Invalid registry environment; preserve it for diagnosis.')
    }
    if (
      roots.has(environment.root) ||
      slugs.has(environment.slug) ||
      ids.has(environment.worktreeId)
    )
      throw new Error('Duplicate registry environment; preserve it for diagnosis.')
    roots.add(environment.root)
    slugs.add(environment.slug)
    ids.add(environment.worktreeId)
    if (environment.role === 'primary') primaryCount++
  }
  if (primaryCount !== 1) throw new Error('Registry must contain exactly one primary environment.')
  const usedPorts = new Set<number>()
  for (const [id, run] of Object.entries(registry.runs)) {
    if (
      !ids.has(id) ||
      !run ||
      typeof run !== 'object' ||
      typeof run.instanceId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(run.instanceId) ||
      !Number.isInteger(run.port) ||
      run.port < 1 ||
      run.port > 65535 ||
      usedPorts.has(run.port) ||
      !Number.isInteger(run.starterPid) ||
      run.starterPid <= 0 ||
      !Number.isFinite(Date.parse(run.deadline)) ||
      !['starting', 'running'].includes(run.phase) ||
      !['full', 'control-only'].includes(run.mode) ||
      (run.phase === 'running' &&
        (!Number.isInteger(run.pid) ||
          !run.pid ||
          run.pid <= 0 ||
          typeof run.processStartedAt !== 'string' ||
          !Number.isFinite(Date.parse(run.processStartedAt))))
    ) {
      throw new Error('Invalid registry run; preserve it for diagnosis.')
    }
    const retired = run.retiredPorts ?? []
    if (
      !Array.isArray(retired) ||
      retired.some(
        (port) =>
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535 ||
          port === run.port ||
          usedPorts.has(port),
      ) ||
      new Set(retired).size !== retired.length
    )
      throw new Error('Invalid retired Hub ports; preserve the registry for diagnosis.')
    usedPorts.add(run.port)
    for (const port of retired) usedPorts.add(port)
    if (run.servicePorts !== undefined) {
      if (
        !run.servicePorts ||
        typeof run.servicePorts !== 'object' ||
        Array.isArray(run.servicePorts)
      )
        throw new Error('Invalid service port allocation; preserve the registry for diagnosis.')
      for (const [name, port] of Object.entries(run.servicePorts)) {
        if (
          !/^[a-z][a-z0-9-]*$/.test(name) ||
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535 ||
          usedPorts.has(port)
        )
          throw new Error('Invalid or conflicting service port allocation.')
        usedPorts.add(port)
      }
    }
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`)
    await handle.sync()
    await handle.close()
    await rename(temporary, file)
  } catch (error) {
    await handle.close().catch(() => {})
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

async function locked<T>(directory: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const lock = path.join(directory, 'registry.lock')
  const deadline = Date.now() + 5000
  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() >= deadline)
        throw new Error(`Registry is locked at ${lock}; inspect the owner before recovery.`)
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  try {
    return await fn()
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}

async function readVerifiedRegistry(directory: string): Promise<TRegistry> {
  const primary = await readJson<TPrimary>(path.join(directory, 'primary.json'))
  const registry = await readJson<TRegistry>(path.join(directory, 'registry.json'))
  if (!primary || primary.version !== 1 || !registry)
    throw new Error('Registry identity is unavailable.')
  validateRegistry(registry)
  const primaryEnvironment = registry.environments.find((item) => item.role === 'primary')
  if (
    !primaryEnvironment ||
    primaryEnvironment.root !== primary.root ||
    primaryEnvironment.commonDir !== primary.commonDir ||
    primaryEnvironment.claimToken !== primary.claimToken
  )
    throw new Error('Primary identity does not match the registry.')
  return registry
}

async function registeredRegistry(
  directory: string,
  identity: TCheckoutIdentity,
): Promise<TRegistry> {
  const registry = await readVerifiedRegistry(directory)
  const environment = registry.environments.find((item) => item.root === identity.root)
  if (
    !environment ||
    environment.worktreeId !== identity.worktreeId ||
    environment.commonDir !== identity.commonDir
  )
    throw new Error('Checkout is not registered or its identity changed.')
  await verifyCheckoutClaim(identity.root, identity.worktreeId, environment.claimToken)
  return registry
}

/** Read redacted checkout ownership states without adopting or removing any environment. */
export async function inspectRegisteredEnvironments(directory: string) {
  const registry = await locked(directory, () => readVerifiedRegistry(directory))
  return Promise.all(
    registry.environments.map(async (environment) => {
      let ownership: 'verified' | 'missing' | 'unverified' = 'unverified'
      let rootChecked = false
      try {
        const entry = await lstat(environment.root)
        rootChecked = true
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          const identity = await resolveCheckout(environment.root)
          if (
            identity.root === environment.root &&
            identity.commonDir === environment.commonDir &&
            identity.worktreeId === environment.worktreeId
          ) {
            await verifyCheckoutClaim(
              environment.root,
              environment.worktreeId,
              environment.claimToken,
            )
            ownership = 'verified'
          }
        }
      } catch (error) {
        if (!rootChecked && (error as NodeJS.ErrnoException).code === 'ENOENT')
          ownership = 'missing'
      }
      return {
        root: environment.root,
        worktreeId: environment.worktreeId,
        slug: environment.slug,
        role: environment.role,
        ownership,
        reportedPhase: registry.runs[environment.worktreeId]?.phase || null,
      }
    }),
  )
}

/** Read this checkout's run only after validating the primary and checkout claim. */
export async function readRegisteredRun(
  directory: string,
  identity: TCheckoutIdentity,
): Promise<TRun | null> {
  return locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    return registry.runs[identity.worktreeId] || null
  })
}

/** Return the verified environment and its current run without changing registration. */
export async function readRegisteredState(
  directory: string,
  identity: TCheckoutIdentity,
): Promise<{ environment: TEnvironment; run: TRun | null }> {
  return locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    return {
      environment: registry.environments.find((item) => item.worktreeId === identity.worktreeId)!,
      run: registry.runs[identity.worktreeId] || null,
    }
  })
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false)
      else reject(error)
    })
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () =>
      server.close(() => resolve(true)),
    )
  })
}

/** Verify a startup reservation immediately before a control-only server binds. */
export async function verifyStartingRun(
  directory: string,
  identity: TCheckoutIdentity,
  instanceId: string,
  port: number,
  mode?: 'full' | 'control-only',
): Promise<TEnvironment> {
  return locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const run = registry.runs[identity.worktreeId]
    if (
      !run ||
      run.phase !== 'starting' ||
      run.instanceId !== instanceId ||
      run.port !== port ||
      (mode !== undefined && run.mode !== mode) ||
      Date.parse(run.deadline) <= Date.now()
    ) {
      throw new Error('Startup reservation does not match or has expired.')
    }
    return registry.environments.find(
      (environment) => environment.worktreeId === identity.worktreeId,
    )!
  })
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return true
    throw error
  }
}

/** Reserve one starting instance and a currently bindable port under the registry lock. */
export async function reserveRun(
  directory: string,
  identity: TCheckoutIdentity,
  options: {
    ports?: number[]
    timeoutMs?: number
    mode?: 'full' | 'control-only'
    serviceIds?: string[]
    servicePortPool?: number[]
  } = {},
): Promise<TRun> {
  return locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const environment = registry.environments.find(
      (item) => item.worktreeId === identity.worktreeId,
    )!
    try {
      await access(path.join(identity.root, 'local/dev-hub/config/database-create.lock'))
      throw new Error('A database operation is in progress for this checkout.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (options.mode === 'full' && environment.role !== 'primary' && !options.serviceIds?.length)
      throw new Error('Secondary full mode requires isolated service port reservations.')
    const previous = registry.runs[identity.worktreeId]
    if (previous && (previous.phase !== 'starting' || Date.parse(previous.deadline) > Date.now()))
      throw new Error(
        'A run is already registered for this checkout; diagnose it before starting another.',
      )
    const ports = options.ports || Array.from({ length: 28 }, (_, index) => 4312 + index)
    if (
      ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535) ||
      new Set(ports).size !== ports.length
    )
      throw new Error('Invalid Hub port pool.')
    const occupied = new Set(
      Object.entries(registry.runs)
        .filter(([worktreeId]) => worktreeId !== identity.worktreeId)
        .flatMap(([, run]) => [
          run.port,
          ...(run.retiredPorts || []),
          ...Object.values(run.servicePorts || {}),
        ]),
    )
    const retiredPorts = previous
      ? [
          ...(previous.retiredPorts || []),
          previous.port,
          ...Object.values(previous.servicePorts || {}),
        ]
      : []
    for (const port of retiredPorts) occupied.add(port)
    let selected: number | undefined
    for (const port of ports) {
      if (!occupied.has(port) && (await isPortAvailable(port))) {
        selected = port
        break
      }
    }
    if (selected === undefined) throw new Error('No Hub port is available.')
    occupied.add(selected)
    const serviceIds = options.serviceIds || []
    if (
      new Set(serviceIds).size !== serviceIds.length ||
      serviceIds.some((id) => !/^[a-z][a-z0-9-]*$/.test(id))
    )
      throw new Error('Invalid service identities for port allocation.')
    const servicePortPool =
      options.servicePortPool || Array.from({ length: 8000 }, (_, index) => 12000 + index)
    if (
      new Set(servicePortPool).size !== servicePortPool.length ||
      servicePortPool.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)
    )
      throw new Error('Invalid service port pool.')
    const servicePorts: Record<string, number> = {}
    for (const id of serviceIds) {
      let found: number | undefined
      for (const port of servicePortPool) {
        if (!occupied.has(port) && (await isPortAvailable(port))) {
          found = port
          break
        }
      }
      if (found === undefined) throw new Error('No service port is available.')
      servicePorts[id] = found
      occupied.add(found)
    }
    const timeout = options.timeoutMs ?? 30_000
    if (!Number.isInteger(timeout) || timeout <= 0) throw new Error('Invalid startup timeout.')
    const run: TRun = {
      instanceId: randomUUID(),
      port: selected,
      phase: 'starting',
      mode: options.mode ?? 'control-only',
      starterPid: process.pid,
      deadline: new Date(Date.now() + timeout).toISOString(),
      ...(retiredPorts.length ? { retiredPorts } : {}),
      ...(serviceIds.length ? { servicePorts } : {}),
    }
    registry.runs[identity.worktreeId] = run
    await writeJson(path.join(directory, 'registry.json'), registry)
    return run
  })
}

/** Commit readiness only if the same unexpired startup reservation still owns the checkout. */
export async function markRunReady(
  directory: string,
  identity: TCheckoutIdentity,
  instanceId: string,
  pid: number,
  processStartedAt: string,
): Promise<TRun> {
  return locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const run = registry.runs[identity.worktreeId]
    if (!run || run.instanceId !== instanceId || run.phase !== 'starting')
      throw new Error('Run reservation no longer belongs to this startup.')
    if (Date.parse(run.deadline) <= Date.now()) throw new Error('Run startup reservation expired.')
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(Date.parse(processStartedAt)))
      throw new Error('Invalid Hub process identity.')
    const ready: TRun = { ...run, phase: 'running', pid, processStartedAt }
    registry.runs[identity.worktreeId] = ready
    await writeJson(path.join(directory, 'registry.json'), registry)
    return ready
  })
}

async function assertRunStopped(run: TRun): Promise<void> {
  if (!(await isPortAvailable(run.port)))
    throw new Error('Hub port is still listening; retain the run for diagnosis.')
  for (const port of Object.values(run.servicePorts || {})) {
    if (!(await isPortAvailable(port)))
      throw new Error('A product service port is still listening; retain the run for diagnosis.')
  }
  for (const port of run.retiredPorts || []) {
    if (!(await isPortAvailable(port)))
      throw new Error('A previous Hub port is still listening; retain the run for diagnosis.')
  }
  if (run.phase === 'running' && run.pid && isProcessAlive(run.pid))
    throw new Error('Recorded Hub process may still be alive; retain the run for diagnosis.')
}

/** Check that a reservation is stopped while continuing to reserve all of its ports. */
export async function verifyStoppedRun(
  directory: string,
  identity: TCheckoutIdentity,
  instanceId: string,
): Promise<void> {
  await locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const run = registry.runs[identity.worktreeId]
    if (!run || run.instanceId !== instanceId)
      throw new Error('Run reservation no longer belongs to this instance.')
    await assertRunStopped(run)
  })
}

/** Release a reservation only after the recorded process and ports are gone. */
export async function releaseRun(
  directory: string,
  identity: TCheckoutIdentity,
  instanceId: string,
): Promise<void> {
  await locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const run = registry.runs[identity.worktreeId]
    if (!run || run.instanceId !== instanceId)
      throw new Error('Run reservation no longer belongs to this instance.')
    await assertRunStopped(run)
    delete registry.runs[identity.worktreeId]
    await writeJson(path.join(directory, 'registry.json'), registry)
  })
}

/** Forget a stopped secondary only after its caller has checked owned resources. */
export async function retireCheckout(
  directory: string,
  identity: TCheckoutIdentity,
  verifyResourcesRemoved: (environment: TEnvironment) => Promise<void>,
): Promise<void> {
  await locked(directory, async () => {
    const registry = await registeredRegistry(directory, identity)
    const environment = registry.environments.find((item) => item.root === identity.root)!
    if (environment.role !== 'secondary') throw new Error('Cannot retire the primary checkout.')
    if (registry.runs[identity.worktreeId])
      throw new Error('Stop the environment before retiring it.')
    await verifyResourcesRemoved(environment)
    registry.environments = registry.environments.filter((item) => item.root !== identity.root)
    await writeJson(path.join(directory, 'registry.json'), registry)
    // A failure here leaves a stale claim and prevents implicit re-registration;
    // it does not allow another checkout to inherit the retired identity.
    try {
      await rm(path.join(identity.root, 'local/dev-hub/config/checkout-claim.json'))
    } catch (error) {
      throw new Error(
        'Environment was retired, but its checkout claim remains; inspect it before re-registering.',
        { cause: error },
      )
    }
  })
}

/** Register a checkout after the primary identity has been initialized. */
export async function registerCheckout(
  directory: string,
  identity: TCheckoutIdentity,
): Promise<TEnvironment> {
  return locked(directory, async () => {
    const primary = await readJson<TPrimary>(path.join(directory, 'primary.json'))
    const registryPath = path.join(directory, 'registry.json')
    const registry = await readJson<TRegistry>(registryPath)
    if (
      !primary ||
      primary.version !== 1 ||
      typeof primary.root !== 'string' ||
      typeof primary.commonDir !== 'string' ||
      !/^[a-f0-9]{64}$/.test(primary.claimToken)
    )
      throw new Error(
        'Primary identity is missing or invalid; explicit initialization or recovery is required.',
      )
    if (!registry) throw new Error('Registry is missing; explicit recovery is required.')
    validateRegistry(registry)
    const primaryEnvironment = registry.environments.find(
      (environment) => environment.role === 'primary',
    )
    if (
      !primaryEnvironment ||
      primaryEnvironment.root !== primary.root ||
      primaryEnvironment.commonDir !== primary.commonDir ||
      primaryEnvironment.claimToken !== primary.claimToken
    )
      throw new Error('Registry primary does not match the primary identity.')
    const found = registry.environments.find((environment) => environment.root === identity.root)
    if (found) {
      if (found.commonDir !== identity.commonDir || found.worktreeId !== identity.worktreeId)
        throw new Error('Checkout ownership differs from its existing registration.')
      await verifyCheckoutClaim(identity.root, identity.worktreeId, found.claimToken)
      return found
    }
    if (
      identity.root === primary.root ||
      (identity.commonDir === primary.commonDir && identity.mainRoot !== primary.root)
    )
      throw new Error('Checkout Git identity does not match the registered primary.')
    const baseSlug = checkoutSlug(identity)
    const collision = registry.environments.some((environment) => environment.slug === baseSlug)
    const slug = checkoutSlug(identity, collision)
    if (
      registry.environments.some(
        (environment) =>
          environment.slug === slug || environment.worktreeId === identity.worktreeId,
      )
    )
      throw new Error('Checkout identity or slug is already registered.')
    const claimToken = await createCheckoutClaim(identity.root, identity.worktreeId)
    const environment: TEnvironment = {
      root: identity.root,
      commonDir: identity.commonDir,
      worktreeId: identity.worktreeId,
      claimToken,
      slug,
      role: 'secondary',
      createdAt: new Date().toISOString(),
    }
    registry.environments.push(environment)
    await writeJson(registryPath, registry)
    return environment
  })
}

/** Initialize a primary checkout explicitly and register it atomically under the shared lock. */
export async function initializePrimary(
  directory: string,
  identity: TCheckoutIdentity,
): Promise<TEnvironment> {
  return locked(directory, async () => {
    if (!identity.isMainWorktree) throw new Error('Primary must be the Git main worktree.')
    const primaryPath = path.join(directory, 'primary.json')
    const registryPath = path.join(directory, 'registry.json')
    const primary = await readJson<TPrimary>(primaryPath)
    if (
      primary &&
      (primary.version !== 1 ||
        primary.root !== identity.root ||
        primary.commonDir !== identity.commonDir ||
        !/^[a-f0-9]{64}$/.test(primary.claimToken))
    )
      throw new Error('The existing primary record does not match this checkout.')
    const existing = await readJson<TRegistry>(registryPath)
    if (existing) validateRegistry(existing)
    if (!primary && existing)
      throw new Error('Primary identity is missing; explicit recovery is required.')
    const claimToken = primary
      ? primary.claimToken
      : await createCheckoutClaim(identity.root, identity.worktreeId)
    if (primary) await verifyCheckoutClaim(identity.root, identity.worktreeId, claimToken)
    if (!primary)
      await writeJson(primaryPath, {
        version: 1,
        root: identity.root,
        commonDir: identity.commonDir,
        claimToken,
      })
    const registry: TRegistry = existing || { version: 1, environments: [], runs: {} }
    const found = registry.environments.find((environment) => environment.root === identity.root)
    if (found) {
      if (
        found.role !== 'primary' ||
        found.commonDir !== identity.commonDir ||
        found.worktreeId !== identity.worktreeId ||
        found.claimToken !== claimToken
      )
        throw new Error('Primary environment registration does not match the checkout.')
      return found
    }
    if (registry.environments.some((environment) => environment.role === 'primary'))
      throw new Error('Registry already contains another primary environment.')
    const environment: TEnvironment = {
      root: identity.root,
      commonDir: identity.commonDir,
      worktreeId: identity.worktreeId,
      claimToken,
      slug: checkoutSlug(identity),
      role: 'primary',
      createdAt: new Date().toISOString(),
    }
    registry.environments.push(environment)
    await writeJson(registryPath, registry)
    return environment
  })
}
