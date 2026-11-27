export type TDatabasePurpose = 'dev' | 'test' | 'rehearsal'

export type TDatabaseMarker = {
  namespace: 'groupher-devhub'
  formatVersion: 1
  worktreeId: string
  purpose: TDatabasePurpose
  run?: string
  previousComment: string | null
}

export type TDatabaseTarget = {
  hostname: string
  port: number
  database: string
  worktreeId: string
  purpose: TDatabasePurpose
  run?: string
}

export type TDatabaseTargetFile = {
  version: 1
  worktreeId: string
  targets: Partial<Record<'dev' | 'test', { hostname: string; port: number; database: string }>>
}

const ID = /^[a-f0-9]{16}$/
const NAME = /^[a-z][a-z0-9_]{0,62}$/
const RUN = /^[a-z][a-z0-9-]{0,39}$/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Reject deployment environments and ambiguous connection URLs before managed database operations. */
export function assertManagedDatabaseEnvironment(environment: NodeJS.ProcessEnv): void {
  if (
    environment.CI === 'true' ||
    ['NODE_ENV', 'MIX_ENV', 'ENVIRONMENT', 'CLOUDFLARE_ENV'].some(
      (key) =>
        !['', 'dev', 'development', 'local', 'test'].includes(
          environment[key]?.trim().toLowerCase() || '',
        ),
    )
  ) {
    throw new Error('Managed database operations require a local development environment.')
  }
  if (environment.DATABASE_URL)
    throw new Error('DATABASE_URL conflicts with a managed local target.')
}

/** Allocate names from a registered identity, independently of PostgreSQL's identifier rules. */
export function databaseTargetForEnvironment(
  environment: { role: 'primary' | 'secondary'; slug: string; worktreeId: string },
  purpose: 'dev' | 'test',
): TDatabaseTarget {
  if (
    !['primary', 'secondary'].includes(environment.role) ||
    !ID.test(environment.worktreeId) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(environment.slug)
  )
    throw new Error('Invalid registered database environment.')
  const component = environment.slug.replaceAll('-', '_').slice(0, 30)
  const database =
    environment.role === 'primary'
      ? `groupher_server_${purpose}`
      : `groupher_${component}_${environment.worktreeId}_${purpose}`
  const target: TDatabaseTarget = {
    hostname: '127.0.0.1',
    port: 5432,
    database,
    worktreeId: environment.worktreeId,
    purpose,
  }
  validateDatabaseTarget(target)
  return target
}

/** Resolve a registered target and reject conflicting process overrides before connection. */
export function resolveDatabaseTarget(
  file: TDatabaseTargetFile,
  worktreeId: string,
  purpose: 'dev' | 'test',
  environment: NodeJS.ProcessEnv,
): TDatabaseTarget {
  if (
    !file ||
    file.version !== 1 ||
    file.worktreeId !== worktreeId ||
    !file.targets ||
    typeof file.targets !== 'object'
  ) {
    throw new Error('Database target file does not match this checkout.')
  }
  const selection = file.targets[purpose]
  if (!selection || typeof selection !== 'object')
    throw new Error('Database target is not registered.')
  const target: TDatabaseTarget = { ...selection, purpose, worktreeId }
  validateDatabaseTarget(target)
  assertManagedDatabaseEnvironment(environment)
  const names =
    purpose === 'dev'
      ? ['DB_NAME', 'DB_HOST', 'DB_PORT']
      : ['TEST_DB_NAME', 'TEST_DB_HOST', 'TEST_DB_PORT']
  const expected = [target.database, target.hostname, String(target.port)]
  for (let i = 0; i < names.length; i++) {
    if (environment[names[i]] && environment[names[i]] !== expected[i])
      throw new Error(`Conflicting ${names[i]} override.`)
  }
  return target
}

/** Validate the resolved target before opening a connection or constructing SQL. */
export function validateDatabaseTarget(target: TDatabaseTarget): void {
  if (
    !LOCAL_HOSTS.has(target.hostname) ||
    !Number.isInteger(target.port) ||
    target.port < 1 ||
    target.port > 65535 ||
    !NAME.test(target.database) ||
    !ID.test(target.worktreeId)
  ) {
    throw new Error('Invalid local database target.')
  }
  if (
    !['dev', 'test', 'rehearsal'].includes(target.purpose) ||
    (target.purpose === 'rehearsal'
      ? !target.run || !RUN.test(target.run)
      : target.run !== undefined)
  ) {
    throw new Error('Invalid database purpose or rehearsal run.')
  }
}

/** Parse our database comment while preserving unrelated existing comments. */
export function parseDatabaseComment(comment: string | null): TDatabaseMarker | null {
  if (comment === null) return null
  let value: unknown
  try {
    value = JSON.parse(comment)
  } catch {
    if (comment.includes('groupher-devhub')) throw new Error('Malformed database ownership marker.')
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const marker = value as Record<string, unknown>
  if (marker.namespace !== 'groupher-devhub') return null
  if (
    marker.formatVersion !== 1 ||
    typeof marker.worktreeId !== 'string' ||
    !ID.test(marker.worktreeId) ||
    !['dev', 'test', 'rehearsal'].includes(String(marker.purpose)) ||
    !(marker.previousComment === null || typeof marker.previousComment === 'string') ||
    (marker.purpose === 'rehearsal'
      ? typeof marker.run !== 'string' || !RUN.test(marker.run)
      : marker.run !== undefined)
  ) {
    throw new Error('Invalid or unsupported database ownership marker.')
  }
  return marker as TDatabaseMarker
}

/** Verify actual connection identity and marker before a managed operation. */
export function verifyDatabaseOwnership(
  target: TDatabaseTarget,
  actual: { database: string; hostname: string; port: number; comment: string | null },
): TDatabaseMarker {
  validateDatabaseTarget(target)
  if (
    actual.database !== target.database ||
    !LOCAL_HOSTS.has(actual.hostname) ||
    actual.port !== target.port
  )
    throw new Error('Actual database connection does not match the local target.')
  const marker = parseDatabaseComment(actual.comment)
  if (
    !marker ||
    marker.worktreeId !== target.worktreeId ||
    marker.purpose !== target.purpose ||
    marker.run !== target.run
  )
    throw new Error('Database ownership marker does not match the target.')
  return marker
}

/** Construct a PostgreSQL COMMENT statement after validating the identifier. */
export function databaseCommentStatement(
  target: TDatabaseTarget,
  previousComment: string | null,
): string {
  validateDatabaseTarget(target)
  const marker: TDatabaseMarker = {
    namespace: 'groupher-devhub',
    formatVersion: 1,
    worktreeId: target.worktreeId,
    purpose: target.purpose,
    previousComment,
  }
  if (target.run) marker.run = target.run
  const literal = JSON.stringify(marker).replace(/\\/g, '\\\\').replace(/'/g, "''")
  return `COMMENT ON DATABASE "${target.database}" IS E'${literal}'`
}
