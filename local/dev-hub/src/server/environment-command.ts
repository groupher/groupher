import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { databaseTargetForEnvironment, resolveDatabaseTarget } from './database-ownership.ts'
import { localAdminQuery } from './database-postgres.ts'
import { initializePrimary, registerCheckout, retireCheckout } from './environment-registry.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Register the current checkout using its canonical Git identity. */
export async function runEnvironmentCommand(
  args: string[],
  repoRoot: string,
  directory = registryRoot(),
  runtimeEnvironment = process.env,
  queryDatabase?: (database: string, sql: string) => Promise<string>,
): Promise<unknown> {
  if (args.length !== 1 || !['init-primary', 'register', 'retire'].includes(args[0])) {
    throw new Error('Usage: pnpm devhub env init-primary | register | retire')
  }
  if (
    runtimeEnvironment.CI === 'true' ||
    ['NODE_ENV', 'MIX_ENV', 'ENVIRONMENT', 'CLOUDFLARE_ENV'].some(
      (key) =>
        !['', 'dev', 'development', 'local'].includes(
          runtimeEnvironment[key]?.trim().toLowerCase() || '',
        ),
    )
  ) {
    throw new Error('Environment registration is available only for local development.')
  }
  const identity = await resolveCheckout(repoRoot)
  if (args[0] === 'retire') {
    const lock = path.join(identity.root, 'local/dev-hub/config/database-create.lock')
    try {
      await mkdir(lock, { mode: 0o700 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST')
        throw new Error('Database operation is locked; inspect the owner before recovery.')
      throw error
    }
    try {
      await retireCheckout(directory, identity, async (environment) => {
        for (const purpose of ['dev', 'test'] as const) {
          const target = databaseTargetForEnvironment(environment, purpose)
          resolveDatabaseTarget(
            { version: 1, worktreeId: identity.worktreeId, targets: { [purpose]: target } },
            identity.worktreeId,
            purpose,
            runtimeEnvironment,
          )
          const query = queryDatabase
            ? (sql: string) => queryDatabase(target.database, sql)
            : localAdminQuery(target, runtimeEnvironment)
          const result = await query(
            `SELECT datname FROM pg_database WHERE datname = '${target.database}'`,
          )
          if (result)
            throw new Error(`Database ${target.database} still exists; drop it before retirement.`)
        }
      })
      return { root: identity.root, worktreeId: identity.worktreeId, retired: true }
    } finally {
      await rm(lock, { recursive: true, force: true })
    }
  }
  const environment =
    args[0] === 'init-primary'
      ? await initializePrimary(directory, identity)
      : await registerCheckout(directory, identity)
  return {
    root: environment.root,
    commonDir: environment.commonDir,
    worktreeId: environment.worktreeId,
    slug: environment.slug,
    role: environment.role,
    createdAt: environment.createdAt,
  }
}
