import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { verifyManagedDatabase } from './database-ready.ts'
import { registryRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Run the ordinary Mix migration after validating the checkout's allocated target. */
export async function migrateManagedDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  environment: NodeJS.ProcessEnv = process.env,
  run: (
    root: string,
    purpose: 'dev' | 'test',
    environment: NodeJS.ProcessEnv,
    task: 'ecto.migrate' | 'ecto.migrations',
  ) => Promise<{
    stdout: string
    stderr: string
  }> = async (checkout, selectedPurpose, runtimeEnvironment, task) =>
    promisify(execFile)('mix', [task], {
      cwd: path.join(checkout, 'backend/api'),
      env: { ...runtimeEnvironment, MIX_ENV: selectedPurpose },
      maxBuffer: 32 * 1024 * 1024,
    }),
  query?: (sql: string) => Promise<string>,
) {
  const identity = await resolveCheckout(root)
  if (environment.MIX_ENV && environment.MIX_ENV !== purpose)
    throw new Error('MIX_ENV conflicts with the requested database purpose.')
  const selected = await verifyManagedDatabase(
    identity.root,
    purpose,
    directory,
    environment,
    query,
  )
  const migrationEnvironment = {
    ...environment,
    DB_NAME: selected.database,
    DB_HOST: selected.hostname,
    DB_PORT: String(selected.port),
    TEST_DB_NAME: selected.database,
    TEST_DB_HOST: selected.hostname,
    TEST_DB_PORT: String(selected.port),
    GROUPHER_MANAGED_MIGRATION_DATABASE: selected.database,
    GROUPHER_MANAGED_MIGRATION_HOST: selected.hostname,
    GROUPHER_MANAGED_MIGRATION_PORT: String(selected.port),
  }
  const { stdout, stderr } = await run(identity.root, purpose, migrationEnvironment, 'ecto.migrate')
  try {
    const versions = await run(identity.root, purpose, migrationEnvironment, 'ecto.migrations')
    return {
      status: 'complete',
      target: selected,
      output: stdout,
      warnings: stderr,
      versions: versions.stdout,
      versionWarnings: versions.stderr,
    }
  } catch (error) {
    // A failure to read the version list must not imply the committed
    // migration was rolled back or invite the caller to recreate the database.
    return {
      status: 'partial',
      target: selected,
      output: stdout,
      warnings: stderr,
      versions: null,
      versionError: error instanceof Error ? error.message : 'Could not read migration versions.',
    }
  }
}
