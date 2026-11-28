import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertLocalEnvironmentAllowed } from './local-environment.ts'
import { REPO_ROOT } from './services.ts'
import { workerStateRoot } from './storage-paths.ts'

/** Migrate the D1 state directory used by this checkout's managed Status Worker. */
export async function migrateStatusDatabase(repoRoot = REPO_ROOT): Promise<void> {
  assertLocalEnvironmentAllowed()
  const stateDirectory = path.join(workerStateRoot(repoRoot), 'status')
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        '--filter',
        '@groupher/status',
        'exec',
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'groupher-status',
        '--local',
        '--persist-to',
        stateDirectory,
      ],
      { cwd: REPO_ROOT, stdio: 'inherit', env: process.env },
    )
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`Local Status migration failed (${signal || code}).`))
    })
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateStatusDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
