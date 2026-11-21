/**
 * Owns the private, stable development identity used by Dev Hub managed services.
 *
 * Hub -> private local state -> per-service environment -> existing service manager
 */

import { createHash, createHmac, generateKeyPairSync, randomBytes } from 'node:crypto'
import { chmod, lstat, mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseEnv } from 'node:util'

import { REPO_ROOT, SERVICE_DEFINITIONS, type TServiceDefinition } from './services.ts'

export const MANAGED_ENV_KEYS = new Set([
  'AUTH_COOKIE_DOMAIN',
  'AUTH_LOCAL_ADMIN_LOGIN_ENABLED',
  'AUTH_LOCAL_LOGIN_ENABLED',
  'AUTH_URL',
  'ASSETS_HUB_BATCH_ENDPOINT',
  'ASSETS_HUB_CAPABILITY_SECRET',
  'ASSETS_HUB_CORS_ORIGIN',
  'ASSETS_HUB_DELETE_ENDPOINT',
  'ASSETS_HUB_LOCAL_STORAGE_DIR',
  'ASSETS_HUB_RUNTIME',
  'ASSETS_HUB_ENDPOINT',
  'ASSETS_PUBLIC_ENDPOINT',
  'API_SITE',
  'APPLY_SITE',
  'AUTH_SITE',
  'CONTENT_IMPORT_APP_ENDPOINT',
  'CONTENT_IMPORT_PREVIEW_SECRET',
  'CONTENT_IMPORT_SERVICE_AUTH_AUDIENCE',
  'CONTENT_IMPORT_SERVICE_AUTH_RESOURCE',
  'CONTENT_IMPORT_SERVICE_AUTH_SCOPES',
  'DATABASE_URL',
  'DASH_DEFAULT_COMMUNITY',
  'DASH_SITE',
  'DB_HOST',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT',
  'DB_USERNAME',
  'DEV_HUB_SERVICE_AUTH_PROBE',
  'DEV_HUB_MANAGED_ENVIRONMENT',
  'DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED',
  'DEV_HUB_WORKER_ENV_FILE',
  'DEV_HUB_WORKER_STATE_DIR',
  'DOCUMENT_CONVERTER_APP_ENDPOINT',
  'ENVIRONMENT',
  'GRAPHQL_ENDPOINT',
  'LANDING_SITE',
  'METRIC_IP_SALT',
  'MOCK_GRAPHQL_PORT',
  'NEXT_PUBLIC_ASSETS_HUB_ENDPOINT',
  'NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT',
  'NEXT_PUBLIC_AUTH_ENDPOINT',
  'NEXT_PUBLIC_SITE_URL',
  'PHOENIX_GRAPHQL_ENDPOINT',
  'PHOENIX_PRESS_RESOURCE',
  'PHX_JWT_SECRET',
  'PORT',
  'REVIEW_BOT_TOKEN',
  'SERVICE_AUTH_CLIENT_ID',
  'SERVICE_AUTH_CLIENT_SECRET',
  'SERVICE_AUTH_CLIENTS_JSON',
  'SERVICE_AUTH_CLIENTS_JSON_ADDITIONS',
  'SERVICE_AUTH_CLIENTS_JSON_EXTRA',
  'SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE',
  'SERVICE_AUTH_ISSUER',
  'SERVICE_AUTH_JWKS_URL',
  'SERVICE_AUTH_PHOENIX_RESOURCE',
  'SERVICE_AUTH_RESOURCES_JSON',
  'SERVICE_AUTH_SIGNING_JWK',
  'SERVICE_AUTH_TOKEN_ENDPOINT',
  'SERVICE_AUTH_TOKEN_TTL_SECONDS',
  'PRESS_SITE',
])

const KNOWN_CREDENTIAL_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'ASSETS_R2_ACCESS_KEY_ID',
  'ASSETS_R2_SECRET_ACCESS_KEY',
  'AUTH_GITHUB_ID',
  'AUTH_GITHUB_SECRET',
  'CF_API_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'GITHUB_TOKEN',
  'OPENAI_API_KEY',
])

export const LOCAL_ENVIRONMENT_STATE_RELATIVE_PATH =
  'local/dev-hub/.data/local-environment/state.json'
export const LOCAL_ENVIRONMENT_DIRECTORY_RELATIVE_PATH = 'local/dev-hub/.data/local-environment'
export const LOCAL_WORKER_DIRECTORY_RELATIVE_PATH = 'local/dev-hub/.data/local-environment/workers'
export const LOCAL_ENVIRONMENT_MIGRATION_INPUT_FILES = [
  'backend/auth/.env',
  'backend/auth/.env.development',
  'backend/auth/.env.local',
  'frontend/dash/.env',
  'frontend/dash/.env.development',
  'frontend/dash/.env.local',
  'backend/api/.env.local',
  'backend/assets-hub/.env',
  'backend/import/.env',
  'backend/import/.env.development',
  'backend/import/.env.local',
  'backend/press/.env',
] as const
const STATE_FORMAT_VERSION = 1 as const
const LOCK_WAIT_MS = 10_000
const LOCK_POLL_MS = 100
const LEGACY_IDENTITY_KEYS = new Set([
  'NEXTAUTH_SECRET',
  'PHX_JWT_SECRET',
  'SERVICE_AUTH_CLIENTS_JSON',
  'SERVICE_AUTH_CLIENTS_JSON_ADDITIONS',
  'SERVICE_AUTH_CLIENTS_JSON_EXTRA',
  'SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE',
  'SERVICE_AUTH_CLIENT_ID',
  'SERVICE_AUTH_CLIENT_SECRET',
  'SERVICE_AUTH_RESOURCES_JSON',
  'SERVICE_AUTH_SIGNING_JWK',
])

export type TLocalServiceCredential = {
  allowedAudiences: string[]
  allowedScopes: string[]
  clientId: string
  clientRef: string
  secret: string
  serviceName: string
}

export type TLocalEnvironmentState = {
  formatVersion: typeof STATE_FORMAT_VERSION
  repoRoot: string
  secrets: Record<string, string>
  serviceCredentials: Record<string, TLocalServiceCredential>
}

export type TResolvedLocalEnvironment = {
  env: Record<string, string>
}

export class LocalEnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalEnvironmentError'
  }
}

const inFlightPreparations = new Map<string, Promise<TLocalEnvironmentState>>()

export const localEnvironmentPaths = (repoRoot = REPO_ROOT) => {
  const directory = path.join(repoRoot, LOCAL_ENVIRONMENT_DIRECTORY_RELATIVE_PATH)
  return {
    directory,
    lock: path.join(directory, 'state.lock'),
    state: path.join(directory, 'state.json'),
  }
}

export const localWorkerEnvironmentPaths = (serviceId: string, repoRoot = REPO_ROOT) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(serviceId)) {
    throw new LocalEnvironmentError(`Invalid worker service id: ${serviceId}.`)
  }
  const directory = path.join(repoRoot, LOCAL_WORKER_DIRECTORY_RELATIVE_PATH, serviceId)
  return {
    directory,
    envFile: path.join(directory, '.env'),
  }
}

export const ensureLocalWorkerStateDirectory = async (
  serviceId: string,
  repoRoot = REPO_ROOT,
): Promise<{ directory: string }> => {
  const paths = localWorkerEnvironmentPaths(serviceId, repoRoot)
  await mkdir(paths.directory, { recursive: true, mode: 0o700 })
  await chmod(paths.directory, 0o700)
  return { directory: paths.directory }
}

export const writeLocalWorkerEnvironment = async (
  serviceId: string,
  environment: Record<string, string>,
  repoRoot = REPO_ROOT,
): Promise<{ envFile: string; directory: string }> => {
  const paths = localWorkerEnvironmentPaths(serviceId, repoRoot)
  await ensureLocalWorkerStateDirectory(serviceId, repoRoot)
  const serialized = Object.entries(environment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new LocalEnvironmentError(`Invalid worker environment key ${key}.`)
      }
      return `${key}=${JSON.stringify(value)}`
    })
    .join('\n')
    .concat('\n')
  const temporaryPath = `${paths.envFile}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(serialized, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporaryPath, paths.envFile)
    await chmod(paths.envFile, 0o600)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return paths
}

export const assertLocalEnvironmentAllowed = (
  environment: Record<string, string | undefined> = process.env,
): void => {
  const productionMarkers = ['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT']
  const productionKey = productionMarkers.find(
    (key) => environment[key]?.trim().toLowerCase() === 'production',
  )
  if (productionKey) {
    throw new LocalEnvironmentError(
      `Local environment state is unavailable when ${productionKey}=production.`,
    )
  }
}

export const filterParentEnvironment = (
  environment: Record<string, string | undefined>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !isManagedOrCredentialKey(entry[0]),
    ),
  )

export const assertNoManagedEnvironment = (
  source: string,
  environment: Record<string, string | undefined>,
): void => {
  const conflicts = Object.keys(environment).filter((key) => MANAGED_ENV_KEYS.has(key))
  if (conflicts.length > 0) {
    throw new LocalEnvironmentError(
      `${source} contains managed environment keys: ${conflicts.sort().join(', ')}.`,
    )
  }
}

export const assertResolvedEnvironmentWins = (
  definition: TServiceDefinition,
  filteredParent: Record<string, string>,
  resolved: TResolvedLocalEnvironment,
  finalEnvironment: Record<string, string | undefined>,
): void => {
  assertNoManagedEnvironment('filtered parent environment', filteredParent)
  assertNoManagedEnvironment(`${definition.id} definition.env`, definition.env || {})
  for (const key of Object.keys(resolved.env)) {
    if (MANAGED_ENV_KEYS.has(key) && finalEnvironment[key] !== resolved.env[key]) {
      throw new LocalEnvironmentError(
        `${definition.id} did not receive the resolved value for managed key ${key}.`,
      )
    }
  }
}

export const prepareLocalEnvironment = async (
  repoRoot = REPO_ROOT,
  environment: Record<string, string | undefined> = process.env,
  options: { lockWaitMs?: number; processIsAlive?: (pid: number) => boolean } = {},
): Promise<TLocalEnvironmentState> => {
  assertLocalEnvironmentAllowed(environment)
  const root = await realpathOrThrow(repoRoot)
  const paths = localEnvironmentPaths(root)
  const pending = inFlightPreparations.get(paths.state)
  if (pending) return pending

  const preparation = withLock(paths, root, environment, options)
  inFlightPreparations.set(paths.state, preparation)
  try {
    return await preparation
  } finally {
    if (inFlightPreparations.get(paths.state) === preparation) {
      inFlightPreparations.delete(paths.state)
    }
  }
}

export const resolveLocalEnvironment = (
  serviceId: string,
  state: TLocalEnvironmentState,
  definition: TServiceDefinition,
  environment: Record<string, string | undefined> = process.env,
): TResolvedLocalEnvironment => {
  if (definition.id !== serviceId) {
    throw new LocalEnvironmentError(`Service definition mismatch for ${serviceId}.`)
  }

  const env: Record<string, string> = {}
  if (definition.localEnvironment?.env) Object.assign(env, definition.localEnvironment.env)

  const credential = state.serviceCredentials[serviceId]
  if (credential) {
    env.SERVICE_AUTH_CLIENT_ID = credential.clientId
    env.SERVICE_AUTH_CLIENT_SECRET = credential.secret
  }

  for (const [key, value] of Object.entries(definition.localEnvironment?.secrets || {})) {
    const secret =
      value === 'review-ai-worker:token'
        ? createHmac('sha256', state.secrets['auth:session-secret'])
            .update('dev-hub:review-ai-worker:token')
            .digest('base64url')
        : state.secrets[value]
    if (!secret) throw new LocalEnvironmentError(`${serviceId} requires local secret ${value}.`)
    env[key] = secret
  }

  if (serviceId === 'auth') {
    const authDefinition = SERVICE_DEFINITIONS.find((item) => item.id === 'auth')
    const authResources = authDefinition?.localEnvironment?.authResources || {}
    env.SERVICE_AUTH_SIGNING_JWK = state.secrets['auth:service-signing-jwk']
    env.SERVICE_AUTH_CLIENTS_JSON = JSON.stringify(
      Object.values(state.serviceCredentials).map(clientToRegistration),
    )
    env.SERVICE_AUTH_RESOURCES_JSON = JSON.stringify(authResources)
    env.NEXTAUTH_SECRET = state.secrets['auth:session-secret']
    env.AUTH_LOCAL_LOGIN_ENABLED = 'true'
    env.AUTH_LOCAL_ADMIN_LOGIN_ENABLED =
      environment.DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED?.trim() === 'true' ? 'true' : 'false'
  }

  return { env }
}

export const resolveExternalEnvironment = async (
  definition: TServiceDefinition,
): Promise<Record<string, string>> => {
  const keys = definition.localEnvironment?.externalEnvKeys || []
  if (keys.length === 0 || definition.config?.kind !== 'env-files') return {}
  const result: Record<string, string> = {}
  const files = [
    path.join(definition.config.root, '.env.development.local'),
    path.join(definition.config.root, '.env.local'),
    path.join(definition.config.root, '.env.development'),
    path.join(definition.config.root, '.env'),
  ]
  for (const file of files) {
    let parsed: NodeJS.Dict<string>
    try {
      parsed = parseEnv(await readFile(file, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const key of keys) {
      if (result[key] === undefined && parsed[key] !== undefined) result[key] = parsed[key]
    }
  }
  return result
}

export const createSpawnEnvironment = (
  definition: TServiceDefinition,
  parent: Record<string, string | undefined>,
  resolved: TResolvedLocalEnvironment,
  devHubOrigin?: string | null,
): Record<string, string> => {
  const filteredParent = filterParentEnvironment(parent)
  assertNoManagedEnvironment(`${definition.id} definition.env`, definition.env || {})
  const finalEnvironment: Record<string, string> = {
    ...filteredParent,
    DEV_HUB_MANAGED_ENVIRONMENT: 'true',
    FORCE_COLOR: '3',
    CLICOLOR_FORCE: '1',
    TERM: 'xterm-256color',
    ...(devHubOrigin
      ? {
          DEV_HUB_URL: devHubOrigin,
          NEXT_PUBLIC_DEV_HUB_URL: devHubOrigin,
          VITE_DEV_HUB_URL: devHubOrigin,
        }
      : {}),
    ...definition.env,
    ...resolved.env,
  }
  assertResolvedEnvironmentWins(definition, filteredParent, resolved, finalEnvironment)
  return finalEnvironment
}

const withLock = async (
  paths: ReturnType<typeof localEnvironmentPaths>,
  repoRoot: string,
  environment: Record<string, string | undefined>,
  options: { lockWaitMs?: number; processIsAlive?: (pid: number) => boolean },
): Promise<TLocalEnvironmentState> => {
  await mkdir(paths.directory, { recursive: true, mode: 0o700 })
  await chmod(paths.directory, 0o700)
  const lockFile = await acquireLock(paths.lock, options)
  try {
    const existing = await readState(paths.state, repoRoot)
    if (existing) {
      const reconciled = reconcileServiceCredentials(existing)
      if (reconciled !== existing) await writeStateAtomically(paths.state, reconciled)
      return reconciled
    }
    await assertLegacyIdentityMigrated(repoRoot)
    const state = createInitialState(repoRoot)
    await writeStateAtomically(paths.state, state)
    return state
  } finally {
    await lockFile.close()
    await rm(paths.lock, { force: true })
  }
}

const assertLegacyIdentityMigrated = async (repoRoot: string): Promise<void> => {
  const found: string[] = []
  for (const relativePath of LOCAL_ENVIRONMENT_MIGRATION_INPUT_FILES) {
    const file = path.join(repoRoot, relativePath)
    try {
      const fileStat = await lstat(file)
      if (fileStat.isSymbolicLink()) {
        throw new LocalEnvironmentError(
          `Refusing to inspect symlinked migration input ${relativePath}.`,
        )
      }
      const parsed = parseEnv(await readFile(file, 'utf8'))
      if (Object.keys(parsed).some((key) => LEGACY_IDENTITY_KEYS.has(key))) found.push(relativePath)
    } catch (error) {
      if (error instanceof LocalEnvironmentError) throw error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  if (found.length > 0) {
    throw new LocalEnvironmentError(
      `Existing local identity values need explicit migration before Dev Hub can initialize: ${found.join(', ')}. Run the documented migration --check, review it, then --apply.`,
    )
  }
}

export const withLocalEnvironmentLock = async <T>(
  repoRoot: string,
  callback: (paths: ReturnType<typeof localEnvironmentPaths>, realRepoRoot: string) => Promise<T>,
  options: { lockWaitMs?: number; processIsAlive?: (pid: number) => boolean } = {},
): Promise<T> => {
  const realRepoRoot = await realpathOrThrow(repoRoot)
  const paths = localEnvironmentPaths(realRepoRoot)
  await mkdir(paths.directory, { recursive: true, mode: 0o700 })
  await chmod(paths.directory, 0o700)
  const lockFile = await acquireLock(paths.lock, options)
  try {
    return await callback(paths, realRepoRoot)
  } finally {
    await lockFile.close()
    await rm(paths.lock, { force: true })
  }
}

export const writeLocalEnvironmentState = async (
  statePath: string,
  state: TLocalEnvironmentState,
): Promise<void> => writeStateAtomically(statePath, state)

export const validateLocalEnvironmentState = (
  state: TLocalEnvironmentState,
  repoRoot: string,
  statePath: string,
): void => validateState(state, repoRoot, statePath)

const acquireLock = async (
  lockPath: string,
  options: { lockWaitMs?: number; processIsAlive?: (pid: number) => boolean },
) => {
  const startedAt = Date.now()
  const waitMs = options.lockWaitMs ?? LOCK_WAIT_MS
  const processIsAlive = options.processIsAlive ?? isProcessAlive

  while (true) {
    let lockFile: Awaited<ReturnType<typeof open>> | undefined
    try {
      lockFile = await open(lockPath, 'wx', 0o600)
      await lockFile.writeFile(
        JSON.stringify({ createdAt: new Date().toISOString(), pid: process.pid }),
      )
      await lockFile.sync()
      return lockFile
    } catch (error) {
      if (lockFile) {
        await lockFile.close().catch(() => {})
        await rm(lockPath, { force: true }).catch(() => {})
        throw error
      }
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const lockOwner = await readLockOwner(lockPath)
      const elapsed = Date.now() - startedAt
      if (elapsed >= waitMs) {
        const owner = lockOwner
          ? `pid ${lockOwner.pid} (${processIsAlive(lockOwner.pid) ? 'alive' : 'not running'}; created ${lockOwner.createdAt})`
          : 'owner metadata unavailable'
        throw new LocalEnvironmentError(
          `Timed out waiting for local environment lock ${lockPath}; ${owner}. Confirm no writer is active, then remove the stale lock manually and retry.`,
        )
      }
      await delay(Math.min(LOCK_POLL_MS, waitMs - elapsed))
    }
  }
}

const readLockOwner = async (
  lockPath: string,
): Promise<{ createdAt: string; pid: number } | null> => {
  try {
    const value = JSON.parse(await readFile(lockPath, 'utf8')) as {
      createdAt?: unknown
      pid?: unknown
    }
    if (typeof value.pid !== 'number' || typeof value.createdAt !== 'string') return null
    return { createdAt: value.createdAt, pid: value.pid }
  } catch {
    return null
  }
}

const readState = async (
  statePath: string,
  repoRoot: string,
): Promise<TLocalEnvironmentState | null> => {
  let source: string
  try {
    source = await readFile(statePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }

  let state: TLocalEnvironmentState
  try {
    state = JSON.parse(source) as TLocalEnvironmentState
  } catch {
    throw new LocalEnvironmentError(`Local environment state is invalid JSON: ${statePath}.`)
  }
  validateState(state, repoRoot, statePath)
  await chmod(statePath, 0o600)
  return state
}

const validateState = (
  state: TLocalEnvironmentState,
  repoRoot: string,
  statePath: string,
): void => {
  if (
    state.formatVersion !== STATE_FORMAT_VERSION ||
    state.repoRoot !== repoRoot ||
    !state.secrets ||
    !state.serviceCredentials
  ) {
    throw new LocalEnvironmentError(
      `Local environment state does not match this repository or supported format: ${statePath}.`,
    )
  }
}

const writeStateAtomically = async (
  statePath: string,
  state: TLocalEnvironmentState,
): Promise<void> => {
  const temporaryPath = `${statePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  const file = await open(temporaryPath, 'wx', 0o600)
  try {
    await file.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8')
    await file.sync()
  } catch (error) {
    await file.close()
    await rm(temporaryPath, { force: true })
    throw error
  }
  await file.close()
  await rename(temporaryPath, statePath)
  await chmod(statePath, 0o600)
}

const createInitialState = (repoRoot: string): TLocalEnvironmentState => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const signingJwk = privateKey.export({ format: 'jwk' })
  const clientDefinitions = SERVICE_DEFINITIONS.flatMap((definition) =>
    definition.localEnvironment?.serviceAuth
      ? [{ serviceId: definition.id, ...definition.localEnvironment.serviceAuth }]
      : [],
  )
  const serviceCredentials = Object.fromEntries(
    clientDefinitions.map((definition) => [
      definition.serviceId,
      {
        allowedAudiences: definition.allowedAudiences,
        allowedScopes: definition.allowedScopes,
        clientId: definition.clientId,
        clientRef: definition.clientRef,
        secret: randomBytes(32).toString('base64url'),
        serviceName: definition.serviceName,
      },
    ]),
  )
  const secrets: Record<string, string> = {
    'auth:service-signing-jwk': JSON.stringify({ ...signingJwk, kid: 'local-dev-hub-rs256' }),
    'auth:session-secret': randomBytes(32).toString('base64url'),
    'assets-hub:capability-secret': randomBytes(32).toString('base64url'),
    'import:preview-secret': randomBytes(32).toString('base64url'),
    'phoenix:jwt-secret': randomBytes(32).toString('base64url'),
    'press:metric-ip-salt': randomBytes(32).toString('base64url'),
    'review-ai-worker:token': randomBytes(32).toString('base64url'),
  }
  return { formatVersion: STATE_FORMAT_VERSION, repoRoot, secrets, serviceCredentials }
}

const reconcileServiceCredentials = (state: TLocalEnvironmentState): TLocalEnvironmentState => {
  let changed = false
  const serviceCredentials = { ...state.serviceCredentials }
  for (const definition of SERVICE_DEFINITIONS) {
    const policy = definition.localEnvironment?.serviceAuth
    if (!policy) continue
    const existing = serviceCredentials[definition.id]
    if (!existing) {
      serviceCredentials[definition.id] = {
        ...policy,
        secret: randomBytes(32).toString('base64url'),
      }
      changed = true
      continue
    }
    if (
      existing.allowedAudiences.join('\0') !== policy.allowedAudiences.join('\0') ||
      existing.allowedScopes.join('\0') !== policy.allowedScopes.join('\0') ||
      existing.clientId !== policy.clientId ||
      existing.clientRef !== policy.clientRef ||
      existing.serviceName !== policy.serviceName
    ) {
      serviceCredentials[definition.id] = { ...existing, ...policy }
      changed = true
    }
  }
  return changed ? { ...state, serviceCredentials } : state
}

const clientToRegistration = (client: TLocalServiceCredential) => {
  return {
    allowedAudiences: client.allowedAudiences,
    allowedScopes: client.allowedScopes,
    clientId: client.clientId,
    clientRef: client.clientRef,
    credentialHashes: [`sha256:${createHash('sha256').update(client.secret).digest('hex')}`],
    serviceName: client.serviceName,
    status: 'active' as const,
  }
}

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const isManagedOrCredentialKey = (key: string): boolean =>
  MANAGED_ENV_KEYS.has(key) ||
  KNOWN_CREDENTIAL_KEYS.has(key) ||
  /(?:_CLIENT_ID|_CLIENT_SECRET|_SECRET|_TOKEN|_PASSWORD|_API_KEY|_ACCESS_KEY_ID)$/.test(key)

const realpathOrThrow = async (input: string): Promise<string> => {
  return realpath(input)
}

export const localEnvironmentStateMode = async (statePath: string): Promise<number> =>
  (await stat(statePath)).mode & 0o777
