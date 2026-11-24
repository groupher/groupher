import { createHash, randomBytes } from 'node:crypto'
import { chmod, copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import {
  LOCAL_ENVIRONMENT_MIGRATION_INPUT_FILES,
  LOCAL_ENVIRONMENT_STATE_RELATIVE_PATH,
  LocalEnvironmentError,
  localEnvironmentPaths,
  validateLocalEnvironmentState,
  withLocalEnvironmentLock,
  writeLocalEnvironmentState,
  type TLocalEnvironmentState,
  type TLocalServiceCredential,
} from '../src/server/local-environment.ts'
import { REPO_ROOT, SERVICE_DEFINITIONS } from '../src/server/services.ts'

const REGISTRY_KEYS = [
  'SERVICE_AUTH_CLIENTS_JSON',
  'SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE',
  'SERVICE_AUTH_CLIENTS_JSON_ADDITIONS',
  'SERVICE_AUTH_CLIENTS_JSON_EXTRA',
] as const

export type TLocalEnvironmentMigrationResult = {
  conflicts: string[]
  files: string[]
  status: 'applied' | 'conflict' | 'no-migration-needed' | 'no-op' | 'ready'
}

type TMigrationOptions = {
  beforeStateWrite?: () => Promise<void>
}

type TMigrationCandidate = {
  conflicts: string[]
  files: string[]
  importedServiceIds: string[]
  state: TLocalEnvironmentState | null
}

const parseDotenv = async (repoRoot: string, file: string): Promise<Record<string, string>> => {
  const absolutePath = path.join(repoRoot, file)
  try {
    const requireFromAuth = createRequire(path.join(REPO_ROOT, 'backend/auth/package.json'))
    const dotenv = requireFromAuth('dotenv') as {
      parse: (source: string | Buffer) => Record<string, string>
    }
    return dotenv.parse(await readFile(absolutePath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      throw new LocalEnvironmentError(
        'The Auth dotenv parser is unavailable; install repository dependencies before migration.',
      )
    }
    throw error
  }
}

const readInputEnvironment = async (repoRoot: string, files: readonly string[]) => {
  const environment: Record<string, string> = {}
  for (const file of files) {
    for (const [key, value] of Object.entries(await parseDotenv(repoRoot, file))) {
      if (environment[key] === undefined) environment[key] = value
    }
  }
  return environment
}

const isCredentialHashMatch = (secret: string, hashes: unknown): boolean => {
  if (!Array.isArray(hashes)) return false
  const actual = createHash('sha256').update(secret).digest('hex')
  return hashes.some((hash) => typeof hash === 'string' && hash.replace(/^sha256:/, '') === actual)
}

const readRegistrations = (environment: Record<string, string>, conflicts: string[]) => {
  const registrations = new Map<string, Record<string, unknown>>()
  for (const key of REGISTRY_KEYS) {
    const source = environment[key]?.trim()
    if (!source) continue
    let values: unknown
    try {
      values = JSON.parse(source)
    } catch {
      conflicts.push(`${key} is not valid JSON`)
      continue
    }
    if (!Array.isArray(values)) {
      conflicts.push(`${key} must contain a JSON array`)
      continue
    }
    for (const value of values) {
      if (
        !value ||
        typeof value !== 'object' ||
        typeof (value as Record<string, unknown>).clientId !== 'string'
      ) {
        conflicts.push(`${key} contains an invalid client registration`)
        continue
      }
      const registration = value as Record<string, unknown>
      const clientId = registration.clientId as string
      if (registrations.has(clientId)) conflicts.push(`duplicate Auth registration for ${clientId}`)
      else registrations.set(clientId, registration)
    }
  }
  return registrations
}

const hasMigrationInputs = async (repoRoot: string): Promise<boolean> => {
  const auth = await readInputEnvironment(repoRoot, [
    'backend/auth/.env.local',
    'backend/auth/.env.development',
    'backend/auth/.env',
  ])
  return Boolean(
    auth.SERVICE_AUTH_SIGNING_JWK ||
    auth.SERVICE_AUTH_RESOURCES_JSON ||
    REGISTRY_KEYS.some((key) => auth[key]),
  )
}

const createMigrationCandidate = async (repoRoot: string): Promise<TMigrationCandidate> => {
  const files: string[] = []
  for (const file of LOCAL_ENVIRONMENT_MIGRATION_INPUT_FILES) {
    try {
      const metadata = await lstat(path.join(repoRoot, file))
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        return {
          conflicts: [`${file} is not a regular file`],
          files,
          importedServiceIds: [],
          state: null,
        }
      }
      files.push(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  if (!(await hasMigrationInputs(repoRoot)))
    return { conflicts: [], files, importedServiceIds: [], state: null }

  const conflicts: string[] = []
  const authEnvironment = await readInputEnvironment(repoRoot, [
    'backend/auth/.env.local',
    'backend/auth/.env.development',
    'backend/auth/.env',
  ])
  const registrations = readRegistrations(authEnvironment, conflicts)
  const authDefinition = SERVICE_DEFINITIONS.find((item) => item.id === 'auth')
  const expectedResources = authDefinition?.localEnvironment?.authResources || {}
  let oldResources: Record<string, string> = {}
  try {
    oldResources = JSON.parse(authEnvironment.SERVICE_AUTH_RESOURCES_JSON || '{}') as Record<
      string,
      string
    >
  } catch {
    conflicts.push('SERVICE_AUTH_RESOURCES_JSON is not valid JSON')
  }
  for (const [resource, audience] of Object.entries(expectedResources)) {
    if (oldResources[resource] && oldResources[resource] !== audience) {
      conflicts.push(`resource mapping conflicts: ${resource}`)
    }
  }

  const serviceCredentials: Record<string, TLocalServiceCredential> = {}
  const importedServiceIds: string[] = []
  const requiredAuthServices = SERVICE_DEFINITIONS.filter(
    (item) => item.localEnvironment?.serviceAuth,
  )
  const knownClientIds = new Set(
    requiredAuthServices.map((item) => item.localEnvironment!.serviceAuth!.clientId),
  )

  for (const definition of requiredAuthServices) {
    const requirement = definition.localEnvironment!.serviceAuth!
    const registration = registrations.get(requirement.clientId)
    if (!registration) {
      serviceCredentials[definition.id] = {
        allowedAudiences: requirement.allowedAudiences,
        allowedScopes: requirement.allowedScopes,
        clientId: requirement.clientId,
        clientRef: requirement.clientRef,
        secret: randomBytes(32).toString('base64url'),
        serviceName: requirement.serviceName,
      }
      continue
    }
    if (
      registration.serviceName !== requirement.serviceName ||
      registration.clientRef !== requirement.clientRef
    ) {
      conflicts.push(`Auth registration identity conflicts for ${requirement.clientId}`)
      continue
    }
    const registeredAudiences = Array.isArray(registration.allowedAudiences)
      ? registration.allowedAudiences
      : []
    const registeredScopes = Array.isArray(registration.allowedScopes)
      ? registration.allowedScopes
      : []
    if (!requirement.allowedAudiences.every((value) => registeredAudiences.includes(value))) {
      conflicts.push(`Auth registration is missing a required audience for ${requirement.clientId}`)
      continue
    }
    if (!requirement.allowedScopes.every((value) => registeredScopes.includes(value))) {
      conflicts.push(`Auth registration is missing a required scope for ${requirement.clientId}`)
      continue
    }

    const sourceFile = serviceCredentialSource(definition.id)
    const sourceEnvironment = sourceFile ? await parseDotenv(repoRoot, sourceFile) : {}
    const secret = sourceEnvironment.SERVICE_AUTH_CLIENT_SECRET?.trim()
    const clientId = sourceEnvironment.SERVICE_AUTH_CLIENT_ID?.trim()
    if (
      !secret ||
      clientId !== requirement.clientId ||
      !isCredentialHashMatch(secret, registration.credentialHashes)
    ) {
      conflicts.push(`Cannot verify the existing plaintext credential for ${requirement.clientId}`)
      continue
    }

    serviceCredentials[definition.id] = {
      allowedAudiences: requirement.allowedAudiences,
      allowedScopes: requirement.allowedScopes,
      clientId: requirement.clientId,
      clientRef: requirement.clientRef,
      secret,
      serviceName: requirement.serviceName,
    }
    importedServiceIds.push(definition.id)
  }

  for (const clientId of registrations.keys()) {
    if (!knownClientIds.has(clientId)) conflicts.push(`unclassified Auth registration: ${clientId}`)
  }

  const signingJwk = authEnvironment.SERVICE_AUTH_SIGNING_JWK?.trim()
  if (!signingJwk) conflicts.push('SERVICE_AUTH_SIGNING_JWK is missing')
  else {
    try {
      const parsed = JSON.parse(signingJwk) as Record<string, unknown>
      if (parsed.kty !== 'RSA' || typeof parsed.d !== 'string' || typeof parsed.n !== 'string') {
        conflicts.push('SERVICE_AUTH_SIGNING_JWK is not a private RSA JWK')
      }
    } catch {
      conflicts.push('SERVICE_AUTH_SIGNING_JWK is not valid JSON')
    }
  }

  const dash = await parseDotenv(repoRoot, 'frontend/dash/.env.local')
  if (
    dash.SERVICE_AUTH_CLIENT_ID &&
    (dash.SERVICE_AUTH_CLIENT_ID !== 'dash-development' || !serviceCredentials.dash)
  ) {
    conflicts.push(
      'Dash identity is not the expected dash-development / dev-hub-local-dash registration',
    )
  }

  if (conflicts.length > 0) return { conflicts, files, importedServiceIds, state: null }

  const authSecret = authEnvironment.NEXTAUTH_SECRET?.trim()
  const assetsEnvironment = await readInputEnvironment(repoRoot, ['backend/assets-hub/.env'])
  const phoenixEnvironment = await readInputEnvironment(repoRoot, ['backend/api/.env.local'])
  const importEnvironment = await readInputEnvironment(repoRoot, [
    'backend/import/.env',
    'backend/import/.env.development',
    'backend/import/.env.local',
  ])
  const pressEnvironment = await readInputEnvironment(repoRoot, ['backend/press/.env'])
  const secrets: Record<string, string> = {
    'auth:service-signing-jwk': signingJwk!,
    'auth:session-secret': authSecret || randomBytes(32).toString('base64url'),
    'assets-hub:capability-secret':
      assetsEnvironment.ASSETS_HUB_CAPABILITY_SECRET || randomBytes(32).toString('base64url'),
    'import:preview-secret':
      importEnvironment.IMPORT_PREVIEW_SECRET || randomBytes(32).toString('base64url'),
    'phoenix:jwt-secret':
      phoenixEnvironment.PHX_JWT_SECRET || randomBytes(32).toString('base64url'),
    'press:metric-ip-salt':
      pressEnvironment.METRIC_IP_SALT || randomBytes(32).toString('base64url'),
  }
  const state: TLocalEnvironmentState = {
    formatVersion: 1,
    repoRoot,
    secrets,
    serviceCredentials,
  }
  return { conflicts, files, importedServiceIds, state }
}

const serviceCredentialSource = (serviceId: string): string | null =>
  ({
    auth: 'backend/auth/.env.local',
    'assets-hub': 'backend/assets-hub/.env',
    phoenix: 'backend/api/.env.local',
    dash: 'frontend/dash/.env.local',
  })[serviceId] || null

const writeBackup = async (
  repoRoot: string,
  paths: ReturnType<typeof localEnvironmentPaths>,
  files: readonly string[],
): Promise<void> => {
  const backupRoot = path.join(paths.directory, 'backup')
  try {
    await lstat(backupRoot)
    throw new LocalEnvironmentError(
      `Migration backup already exists: ${backupRoot}. Review it manually before retrying.`,
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await mkdir(backupRoot, { recursive: true, mode: 0o700 })
  await chmod(backupRoot, 0o700)
  const copied: string[] = []
  try {
    for (const file of files) {
      const destination = path.join(backupRoot, file)
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
      await chmod(path.dirname(destination), 0o700)
      await copyFile(path.join(repoRoot, file), destination)
      await chmod(destination, 0o600)
      copied.push(file)
    }
    try {
      await copyFile(paths.state, path.join(backupRoot, 'local-environment/state.json'))
      await chmod(path.join(backupRoot, 'local-environment/state.json'), 0o600)
      copied.push(LOCAL_ENVIRONMENT_STATE_RELATIVE_PATH)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await writeFile(
      path.join(backupRoot, 'manifest.json'),
      `${JSON.stringify({ createdAt: new Date().toISOString(), files: copied }, null, 2)}\n`,
      { mode: 0o600 },
    )
    await chmod(path.join(backupRoot, 'manifest.json'), 0o600)
  } catch (error) {
    // Keep partial private backups for diagnosis; never remove user data automatically.
    throw error
  }
}

export const migrateLocalEnvironment = async (
  repoRoot = REPO_ROOT,
  mode: 'check' | 'apply',
  options: TMigrationOptions = {},
): Promise<TLocalEnvironmentMigrationResult> => {
  const realRepoRoot = await realpath(repoRoot)
  const candidate = await createMigrationCandidate(realRepoRoot)
  if (candidate.conflicts.length > 0) {
    return { conflicts: candidate.conflicts, files: candidate.files, status: 'conflict' }
  }
  if (!candidate.state) {
    return { conflicts: [], files: candidate.files, status: 'no-migration-needed' }
  }

  const paths = localEnvironmentPaths(realRepoRoot)
  try {
    const current = JSON.parse(await readFile(paths.state, 'utf8')) as TLocalEnvironmentState
    validateLocalEnvironmentState(current, realRepoRoot, paths.state)
    if (
      await matchesExistingMigration(
        current,
        candidate.state,
        candidate.importedServiceIds,
        realRepoRoot,
      )
    ) {
      return { conflicts: [], files: candidate.files, status: 'no-op' }
    }
    return {
      conflicts: ['state.json already exists and differs from the migration candidate'],
      files: candidate.files,
      status: 'conflict',
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  if (mode === 'check') return { conflicts: [], files: candidate.files, status: 'ready' }

  return withLocalEnvironmentLock(realRepoRoot, async (lockedPaths, lockedRoot) => {
    try {
      const current = JSON.parse(
        await readFile(lockedPaths.state, 'utf8'),
      ) as TLocalEnvironmentState
      validateLocalEnvironmentState(current, lockedRoot, lockedPaths.state)
      if (
        await matchesExistingMigration(
          current,
          candidate.state!,
          candidate.importedServiceIds,
          lockedRoot,
        )
      ) {
        return { conflicts: [], files: candidate.files, status: 'no-op' }
      }
      return {
        conflicts: ['state.json was created by another writer and differs from the candidate'],
        files: candidate.files,
        status: 'conflict',
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    await writeBackup(lockedRoot, lockedPaths, candidate.files)
    if (options.beforeStateWrite) await options.beforeStateWrite()
    await writeLocalEnvironmentState(lockedPaths.state, candidate.state!)
    return { conflicts: [], files: candidate.files, status: 'applied' }
  })
}

const matchesExistingMigration = async (
  current: TLocalEnvironmentState,
  candidate: TLocalEnvironmentState,
  importedServiceIds: readonly string[],
  repoRoot: string,
): Promise<boolean> => {
  if (
    current.formatVersion !== candidate.formatVersion ||
    current.repoRoot !== candidate.repoRoot ||
    current.secrets['auth:service-signing-jwk'] !== candidate.secrets['auth:service-signing-jwk']
  )
    return false

  for (const serviceId of importedServiceIds) {
    const credential = candidate.serviceCredentials[serviceId]
    if (!credential) return false
    const existing = current.serviceCredentials[serviceId]
    if (
      !existing ||
      existing.clientId !== credential.clientId ||
      existing.clientRef !== credential.clientRef ||
      existing.secret !== credential.secret
    )
      return false
  }

  const auth = await readInputEnvironment(repoRoot, [
    'backend/auth/.env.local',
    'backend/auth/.env.development',
    'backend/auth/.env',
  ])
  const assets = await readInputEnvironment(repoRoot, ['backend/assets-hub/.env'])
  const phoenix = await readInputEnvironment(repoRoot, ['backend/api/.env.local'])
  const importer = await readInputEnvironment(repoRoot, [
    'backend/import/.env',
    'backend/import/.env.development',
    'backend/import/.env.local',
  ])
  const importedValues: Record<string, string | undefined> = {
    'auth:session-secret': auth.NEXTAUTH_SECRET,
    'assets-hub:capability-secret': assets.ASSETS_HUB_CAPABILITY_SECRET,
    'import:preview-secret': importer.IMPORT_PREVIEW_SECRET,
    'phoenix:jwt-secret': phoenix.PHX_JWT_SECRET,
  }
  return (
    Object.entries(importedValues).every(
      ([key, value]) => value === undefined || current.secrets[key] === value,
    ) &&
    Object.keys(current.serviceCredentials).length ===
      Object.keys(candidate.serviceCredentials).length
  )
}

const main = async () => {
  const mode = process.argv[2]
  if (mode !== '--check' && mode !== '--apply') {
    console.error('Usage: tsx scripts/migrate-local-environment.ts --check|--apply')
    process.exitCode = 2
    return
  }
  const result = await migrateLocalEnvironment(REPO_ROOT, mode === '--check' ? 'check' : 'apply')
  console.log(`Local environment migration: ${result.status}`)
  for (const file of result.files) console.log(`- source: ${file}`)
  for (const conflict of result.conflicts) console.error(`- conflict: ${conflict}`)
  if (result.status === 'conflict') process.exitCode = 1
  if (result.status === 'no-migration-needed')
    console.log('No legacy Auth service identity was found; no files were written.')
  if (result.status === 'ready')
    console.log('Check passed; apply can import the legacy identities.')
  if (result.status === 'applied')
    console.log('Migration state committed. Source files remain unchanged.')
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Local environment migration failed.')
    process.exitCode = 1
  })
}
