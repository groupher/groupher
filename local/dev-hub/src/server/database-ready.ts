import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  databaseTargetForEnvironment,
  resolveDatabaseTarget,
  verifyDatabaseOwnership,
  type TDatabaseTarget,
  type TDatabaseTargetFile,
} from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { readRegisteredState } from './environment-registry.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Read and independently verify a registered secondary database before startup. */
export async function verifyManagedDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  execute?: (sql: string) => Promise<string>,
): Promise<TDatabaseTarget> {
  const identity = await resolveCheckout(root)
  const state = await readRegisteredState(directory, identity)
  const expected = databaseTargetForEnvironment(state.environment, purpose)
  let adoption: {
    version?: number
    state?: string
    worktreeId?: string
    database?: string
    previousComment?: unknown
  } | null = null
  let file: TDatabaseTargetFile
  if (state.environment.role === 'primary') {
    if (!identity.isMainWorktree)
      throw new Error('Only a registered primary checkout can use an adopted primary database.')
    let adoptionContents: string
    try {
      adoptionContents = await readFile(
        path.join(
          identity.root,
          'local/dev-hub/config',
          purpose === 'dev'
            ? 'database-primary-adoption.json'
            : 'database-primary-test-adoption.json',
        ),
        'utf8',
      )
    } catch {
      throw new Error('Primary database adoption record is unavailable; preserve it for review.')
    }
    adoption = JSON.parse(adoptionContents)
    if (
      adoption?.version !== 1 ||
      adoption.state !== 'adopted' ||
      adoption.worktreeId !== identity.worktreeId ||
      adoption.database !== expected.database
    )
      throw new Error('Primary database adoption cannot be verified.')
    const hostKey = purpose === 'dev' ? 'DB_HOST' : 'TEST_DB_HOST'
    if (environment[hostKey] && !['localhost', '127.0.0.1', '::1'].includes(environment[hostKey]!))
      throw new Error('Primary database host must be local.')
    file = { version: 1, worktreeId: identity.worktreeId, targets: { [purpose]: expected } }
  } else {
    file = JSON.parse(
      await readFile(path.join(identity.root, 'local/dev-hub/config/database-target.json'), 'utf8'),
    ) as TDatabaseTargetFile
  }
  const target = resolveDatabaseTarget(
    file,
    identity.worktreeId,
    purpose,
    state.environment.role === 'primary'
      ? { ...environment, [purpose === 'dev' ? 'DB_HOST' : 'TEST_DB_HOST']: expected.hostname }
      : environment,
  )
  if (
    target.database !== expected.database ||
    target.hostname !== expected.hostname ||
    target.port !== expected.port
  )
    throw new Error('Database target differs from the registered allocation.')
  const query = execute || localAdminQuery(target, environment)
  const result = await query(
    `SELECT json_build_object('database', datname, 'comment', shobj_description(oid, 'pg_database'))::text FROM pg_database WHERE datname = '${target.database}'`,
  )
  if (!result) throw new Error('The managed database is missing.')
  const marker = verifyDatabaseOwnership(target, {
    ...(JSON.parse(result) as { database: string; comment: string | null }),
    hostname: target.hostname,
    port: target.port,
  })
  if (adoption && marker.previousComment !== adoption.previousComment)
    throw new Error('Primary database marker differs from the adoption record.')
  return target
}
