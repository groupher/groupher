import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import {
  databaseTargetForEnvironment,
  resolveDatabaseTarget,
  verifyDatabaseOwnership,
  type TDatabaseTargetFile,
} from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { cleanTargetReaders } from './database-read-only.ts'
import { readRegisteredState } from './environment-registry.ts'
import { registryRoot, userDataRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Drop a stopped secondary target only after ownership and fixture cleanup are verified. */
export async function dropManagedDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  reportDirectory?: string,
  execute?: (database: 'admin' | 'target', sql: string) => Promise<string>,
) {
  const identity = await resolveCheckout(root)
  const state = await readRegisteredState(directory, identity)
  if (state.environment.role !== 'secondary')
    throw new Error('The primary database cannot be dropped by this command.')
  if (state.run) throw new Error('Stop the registered environment before dropping its database.')
  const filename = path.join(identity.root, 'local/dev-hub/config/database-target.json')
  const file = JSON.parse(await readFile(filename, 'utf8')) as TDatabaseTargetFile
  const target = resolveDatabaseTarget(file, identity.worktreeId, purpose, environment)
  const expected = databaseTargetForEnvironment(state.environment, purpose)
  if (
    target.database !== expected.database ||
    target.hostname !== expected.hostname ||
    target.port !== expected.port
  )
    throw new Error('Database target differs from the registered allocation.')
  const admin = execute
    ? (sql: string) => execute('admin', sql)
    : localAdminQuery(target, environment)
  const database = execute
    ? (sql: string) => execute('target', sql)
    : localAdminQuery(target, environment, target.database)
  const lock = path.join(identity.root, 'local/dev-hub/config/database-create.lock')
  try {
    await mkdir(lock, { mode: 0o700 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('Database operation is locked; inspect the owner before recovery.')
    throw error
  }
  try {
    // Recheck the instance under the database operation lock.
    if ((await readRegisteredState(directory, identity)).run)
      throw new Error('The environment started during database recovery.')
    const result = await admin(
      `SELECT json_build_object('database', datname, 'comment', shobj_description(oid, 'pg_database'))::text FROM pg_database WHERE datname = '${target.database}'`,
    )
    if (!result) {
      if (!execute) await cleanTargetReaders(target, environment, true, false)
      return { target, alreadyDropped: true }
    }
    const actual = JSON.parse(result) as { database: string; comment: string | null }
    verifyDatabaseOwnership(target, { ...actual, hostname: target.hostname, port: target.port })
    const exists = await database("SELECT to_regclass('account.oauth_providers') IS NOT NULL")
    if (!['t', 'f'].includes(exists)) throw new Error('Cannot inspect fixture cleanup state.')
    const fixtureRows =
      exists === 't'
        ? JSON.parse(
            await database(
              `SELECT coalesce(json_agg(json_build_object('run', raw->>'run', 'alias', raw->>'alias', 'status', raw->>'status', 'cleanupStatus', raw->>'cleanup_status', 'report', raw->'cleanup_report')), '[]'::json)::text FROM account.oauth_providers WHERE provider = 'local-test-actor-v1'`,
            ),
          )
        : []
    if (
      !Array.isArray(fixtureRows) ||
      fixtureRows.some(
        (row) =>
          !row ||
          row.status !== 'closed' ||
          row.cleanupStatus !== 'cleaned' ||
          !row.report ||
          typeof row.report !== 'object' ||
          Array.isArray(row.report) ||
          row.report.admins_to_remove !== 0 ||
          row.report.coauthors !== 0 ||
          row.report.global_grants_to_restore !== 0 ||
          row.report.pending_requests !== 0 ||
          !Array.isArray(row.report.blockers) ||
          row.report.blockers.length !== 0 ||
          !Array.isArray(row.report.communities_to_archive) ||
          row.report.communities_to_archive.length !== 0,
      )
    )
      throw new Error('Fixture cleanup is incomplete; preserve the database and run cleanup first.')
    if (!execute) await cleanTargetReaders(target, environment, true)
    const reports = reportDirectory || path.join(userDataRoot(identity.root), 'cleanup-reports')
    await mkdir(reports, { recursive: true, mode: 0o700 })
    const reportPath = path.join(reports, `${target.database}-${randomUUID()}.json`)
    const handle = await open(reportPath, 'wx', 0o600)
    try {
      await handle.writeFile(
        `${JSON.stringify({ target, fixtures: fixtureRows, capturedAt: new Date().toISOString() }, null, 2)}\n`,
      )
      await handle.sync()
    } finally {
      await handle.close()
    }
    // No force: active connections prevent deletion and the report is retained.
    await admin(`DROP DATABASE "${target.database}"`)
    return { target, alreadyDropped: false, cleanupReport: reportPath }
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}
