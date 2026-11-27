import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import {
  databaseCommentStatement,
  databaseTargetForEnvironment,
  resolveDatabaseTarget,
  verifyDatabaseOwnership,
  type TDatabaseTargetFile,
} from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { readRegisteredState } from './environment-registry.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Create only a newly allocated secondary database or reuse its verified marker. */
export async function createManagedDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  execute?: (sql: string) => Promise<string>,
) {
  const identity = await resolveCheckout(root)
  const registered = await readRegisteredState(directory, identity)
  if (registered.environment.role !== 'secondary')
    throw new Error('Primary databases require explicit adoption; create cannot adopt them.')
  const target = databaseTargetForEnvironment(registered.environment, purpose)
  const candidate: TDatabaseTargetFile = {
    version: 1,
    worktreeId: identity.worktreeId,
    targets: { [purpose]: target },
  }
  resolveDatabaseTarget(candidate, identity.worktreeId, purpose, environment)
  const query = execute || localAdminQuery(target, environment)

  const configDirectory = path.join(identity.root, 'local/dev-hub/config')
  await mkdir(configDirectory, { recursive: true, mode: 0o700 })
  const lock = path.join(configDirectory, 'database-create.lock')
  try {
    await mkdir(lock, { mode: 0o700 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('Database creation is locked; inspect the owner before recovery.')
    throw error
  }
  try {
    // Registration can change while this operation waits for the database lock.
    // Recheck under the lock before creating a database or writing its target.
    const current = await readRegisteredState(directory, identity)
    if (
      current.environment.role !== 'secondary' ||
      current.environment.slug !== registered.environment.slug ||
      current.environment.claimToken !== registered.environment.claimToken
    )
      throw new Error('Database allocation changed before creation.')
    const filename = path.join(configDirectory, 'database-target.json')
    let file: TDatabaseTargetFile
    try {
      file = JSON.parse(await readFile(filename, 'utf8')) as TDatabaseTargetFile
      if (file.version !== 1 || file.worktreeId !== identity.worktreeId || !file.targets)
        throw new Error('Existing target file does not match this checkout.')
      for (const key of ['dev', 'test'] as const) {
        if (!file.targets[key]) continue
        const expected = databaseTargetForEnvironment(registered.environment, key)
        const actual = resolveDatabaseTarget(file, identity.worktreeId, key, {})
        if (
          actual.database !== expected.database ||
          actual.hostname !== expected.hostname ||
          actual.port !== expected.port ||
          actual.worktreeId !== expected.worktreeId ||
          actual.purpose !== expected.purpose
        )
          throw new Error('Existing target differs from the registered allocation.')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      file = { version: 1, worktreeId: identity.worktreeId, targets: {} }
    }
    const readDatabase = async () => {
      const result = await query(
        `SELECT json_build_object('database', datname, 'comment', shobj_description(oid, 'pg_database'))::text FROM pg_database WHERE datname = '${target.database}'`,
      )
      return result ? (JSON.parse(result) as { database: string; comment: string | null }) : null
    }
    let existing = await readDatabase()
    let created = false
    if (!existing) {
      // CREATE DATABASE is atomic. A concurrent winner or an interrupted marker
      // write is never adopted: both paths return an error and require inspection.
      await query(`CREATE DATABASE "${target.database}"`)
      created = true
      await query(databaseCommentStatement(target, null))
      existing = await readDatabase()
    }
    if (!existing) throw new Error('Created database could not be inspected.')
    verifyDatabaseOwnership(target, {
      ...existing,
      hostname: target.hostname,
      port: target.port,
    })
    file.targets[purpose] = {
      hostname: target.hostname,
      port: target.port,
      database: target.database,
    }
    const temporary = `${filename}.${randomUUID()}.tmp`
    const handle = await open(temporary, 'wx', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(file, null, 2)}\n`)
      await handle.sync()
      await handle.close()
      await rename(temporary, filename)
    } catch (error) {
      await handle.close().catch(() => {})
      await rm(temporary, { force: true }).catch(() => {})
      throw error
    }
    return { target, created }
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}
