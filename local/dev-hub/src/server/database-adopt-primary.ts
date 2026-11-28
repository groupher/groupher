import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import {
  databaseCommentStatement,
  databaseTargetForEnvironment,
  parseDatabaseComment,
  resolveDatabaseTarget,
  verifyDatabaseOwnership,
} from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { readRegisteredState } from './environment-registry.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

type TAdoption = {
  version: 1
  worktreeId: string
  database: string
  previousComment: string | null
  state: 'prepared' | 'adopted' | 'reverted'
}

/** Parse the explicit primary target and optional reversal before opening a database. */
export function parsePrimaryAdoptionOptions(options: string[]) {
  let purpose: 'dev' | 'test' = 'dev'
  let revert = false
  let targeted = false
  for (let index = 0; index < options.length; index++) {
    if (options[index] === '--revert' && !revert) revert = true
    else if (
      options[index] === '--target' &&
      !targeted &&
      ['dev', 'test'].includes(options[index + 1])
    ) {
      purpose = options[++index] as 'dev' | 'test'
      targeted = true
    } else throw new Error('Usage: pnpm devhub db adopt-primary [--target dev|test] [--revert]')
  }
  return { purpose, revert }
}

/** Adopt or revert one explicitly registered primary local database. */
export async function adoptPrimaryDatabase(
  root: string,
  revert: boolean,
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  execute?: (sql: string) => Promise<string>,
  purpose: 'dev' | 'test' = 'dev',
) {
  const identity = await resolveCheckout(root)
  const { environment: registration } = await readRegisteredState(directory, identity)
  if (registration.role !== 'primary' || !identity.isMainWorktree)
    throw new Error('Only the registered main primary checkout can adopt its database.')
  const target = databaseTargetForEnvironment(registration, purpose)
  const hostKey = purpose === 'dev' ? 'DB_HOST' : 'TEST_DB_HOST'
  if (
    (environment[hostKey] && !['localhost', '127.0.0.1', '::1'].includes(environment[hostKey]!)) ||
    (environment.MIX_ENV &&
      !['dev', ...(purpose === 'test' ? ['test'] : [])].includes(environment.MIX_ENV)) ||
    ['NODE_ENV', 'ENVIRONMENT', 'CLOUDFLARE_ENV'].some(
      (key) =>
        !['', 'dev', 'development', 'local'].includes(environment[key]?.trim().toLowerCase() || ''),
    )
  )
    throw new Error('Primary adoption requires the local development environment.')
  resolveDatabaseTarget(
    { version: 1, worktreeId: identity.worktreeId, targets: { [purpose]: target } },
    identity.worktreeId,
    purpose,
    { ...environment, [hostKey]: target.hostname },
  )
  const query = execute || localAdminQuery(target, environment)
  const config = path.join(identity.root, 'local/dev-hub/config')
  await mkdir(config, { recursive: true, mode: 0o700 })
  const lock = path.join(config, 'database-create.lock')
  try {
    await mkdir(lock, { mode: 0o700 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('Database operation is locked; inspect the owner before recovery.')
    throw error
  }
  try {
    const filename = path.join(
      config,
      purpose === 'dev' ? 'database-primary-adoption.json' : 'database-primary-test-adoption.json',
    )
    let record: TAdoption | null
    try {
      record = JSON.parse(await readFile(filename, 'utf8')) as TAdoption
      if (
        record.version !== 1 ||
        record.worktreeId !== identity.worktreeId ||
        record.database !== target.database ||
        !['prepared', 'adopted', 'reverted'].includes(record.state) ||
        !(record.previousComment === null || typeof record.previousComment === 'string')
      )
        throw new Error('The primary adoption record is invalid.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      record = null
    }
    const result = await query(
      `SELECT json_build_object('database', datname, 'comment', shobj_description(oid, 'pg_database'))::text FROM pg_database WHERE datname = '${target.database}'`,
    )
    if (!result) throw new Error(`The primary ${purpose} database does not exist.`)
    const actual = JSON.parse(result) as { database: string; comment: string | null }
    const marker = parseDatabaseComment(actual.comment)
    const save = async (value: TAdoption) => {
      const temporary = `${filename}.${randomUUID()}.tmp`
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`)
        await handle.sync()
        await handle.close()
        await rename(temporary, filename)
      } catch (error) {
        await handle.close().catch(() => {})
        await rm(temporary, { force: true }).catch(() => {})
        throw error
      }
    }
    if (marker) {
      verifyDatabaseOwnership(target, { ...actual, hostname: target.hostname, port: target.port })
      if (
        !record ||
        record.state === 'reverted' ||
        record.previousComment !== marker.previousComment
      )
        throw new Error('Primary marker is not associated with this adoption record.')
    }
    if (revert) {
      if (!record) throw new Error('No primary adoption record exists.')
      if (marker) {
        const previous =
          record.previousComment === null
            ? 'NULL'
            : `E'${record.previousComment.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
        await query(`COMMENT ON DATABASE "${target.database}" IS ${previous}`)
      } else if (actual.comment !== record.previousComment) {
        throw new Error('Primary database comment changed after adoption; preserve it for review.')
      }
      await save({ ...record, state: 'reverted' })
      return { target, adopted: false }
    }
    if (!marker) {
      if (record?.state === 'adopted')
        throw new Error('Primary marker disappeared after adoption; preserve it for review.')
      if (record && record.previousComment !== actual.comment)
        throw new Error('Primary database comment differs from the adoption record.')
      record = {
        version: 1,
        worktreeId: identity.worktreeId,
        database: target.database,
        previousComment: actual.comment,
        state: 'prepared',
      }
      await save(record)
      await query(databaseCommentStatement(target, actual.comment))
    }
    if (!record) throw new Error('Primary adoption record is missing.')
    await save({ ...record, state: 'adopted' })
    return { target, adopted: true }
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}
