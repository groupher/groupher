import { readdir } from 'node:fs/promises'
import path from 'node:path'

import {
  databaseTargetForEnvironment,
  parseDatabaseComment,
  resolveDatabaseTarget,
  verifyDatabaseOwnership,
} from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { verifyManagedDatabase } from './database-ready.ts'
import { readRegisteredState } from './environment-registry.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Read migration versions only after verifying the current checkout's database. */
export async function inspectManagedDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  execute?: (database: 'admin' | 'target', sql: string) => Promise<string>,
) {
  const identity = await resolveCheckout(root)
  const registration = await readRegisteredState(directory, identity)
  const primaryTest = registration.environment.role === 'primary' && purpose === 'test'
  const target = primaryTest
    ? databaseTargetForEnvironment(registration.environment, 'test')
    : await verifyManagedDatabase(
        identity.root,
        purpose,
        directory,
        environment,
        execute ? (sql) => execute('admin', sql) : undefined,
      )
  const query = execute
    ? (sql: string) => execute('target', sql)
    : localAdminQuery(target, environment, target.database)
  if (primaryTest) {
    const normalizedEnvironment =
      environment.TEST_DB_HOST &&
      ['localhost', '127.0.0.1', '::1'].includes(environment.TEST_DB_HOST)
        ? { ...environment, TEST_DB_HOST: target.hostname }
        : environment
    resolveDatabaseTarget(
      { version: 1, worktreeId: identity.worktreeId, targets: { test: target } },
      identity.worktreeId,
      'test',
      normalizedEnvironment,
    )
    const actual = JSON.parse(
      await query(
        "SELECT json_build_object('database', current_database(), 'port', inet_server_port(), 'address', host(inet_server_addr()), 'comment', shobj_description(oid, 'pg_database'))::text FROM pg_database WHERE datname = current_database()",
      ),
    ) as { database: string; port: number; address: string; comment: string | null }
    if (
      actual.database !== target.database ||
      actual.port !== target.port ||
      !['127.0.0.1', '::1'].includes(actual.address)
    )
      throw new Error('Primary test database connection does not match the local target.')
    if (parseDatabaseComment(actual.comment)) {
      verifyDatabaseOwnership(target, { ...actual, hostname: target.hostname })
      await verifyManagedDatabase(
        identity.root,
        'test',
        directory,
        normalizedEnvironment,
        execute ? (sql) => execute('admin', sql) : undefined,
      )
    }
  }
  const table = await query("SELECT to_regclass('public.schema_migrations') IS NOT NULL")
  if (!['t', 'f'].includes(table)) throw new Error('Cannot inspect the migration table.')
  const versions =
    table === 't'
      ? JSON.parse(
          await query(
            "SELECT coalesce(json_agg(version::text ORDER BY version), '[]'::json)::text FROM public.schema_migrations",
          ),
        )
      : []
  if (!Array.isArray(versions) || versions.some((version) => typeof version !== 'string'))
    throw new Error('Invalid migration version response.')
  const files = await readdir(path.join(root, 'backend/api/priv/repo/migrations'))
  const migrations = files.flatMap((file) => {
    const match = /^(\d+)_.*\.exs$/.exec(file)
    return match ? [{ version: match[1], file }] : []
  })
  const registered = new Set<string>()
  for (const migration of migrations) {
    if (registered.has(migration.version))
      throw new Error(`Duplicate migration version in this checkout: ${migration.version}.`)
    registered.add(migration.version)
  }
  const applied = new Set<string>(versions)
  const pending = migrations
    .filter(({ version }) => !applied.has(version))
    .sort((a, b) => a.version.localeCompare(b.version))
  const unknown = versions.filter((version) => !registered.has(version))
  return { target, migrationCount: versions.length, versions, pending, unknown }
}
