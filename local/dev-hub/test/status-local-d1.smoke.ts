/** Exercise the public migration implementation against two disposable local D1 directories. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { REPO_ROOT } from '../src/server/services.ts'
import { migrateStatusDatabase } from '../src/server/status-migrate.ts'
import { userDataRoot, workerStateRoot } from '../src/server/storage-paths.ts'

const require = createRequire(
  realpathSync(path.join(REPO_ROOT, 'ops/status/node_modules/wrangler/package.json')),
)
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const rootA = await mkdtemp(path.join(tmpdir(), 'groupher-status-a-'))
const rootB = await mkdtemp(path.join(tmpdir(), 'groupher-status-b-'))
const databaseId = 'ebdea705-7332-47d4-b2ca-c1c631231a63'
const workerRead = async (root: string) => {
  const worker = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: `export default { async fetch(request, env) {
      const row = await env.DB.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name='service_status'").first();
      return Response.json(row);
    } }`,
      resourcePersistencePath: path.join(workerStateRoot(root), 'status', 'v3'),
      d1Databases: { DB: databaseId },
    }),
  )
  try {
    const response = await worker.dispatchFetch('http://localhost/')
    return (await response.json()).count as number
  } finally {
    await worker.dispose()
  }
}
const query = (root: string) => {
  const output = execFileSync(
    'pnpm',
    [
      '--filter',
      '@groupher/status',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'groupher-status',
      '--local',
      '--persist-to',
      path.join(workerStateRoot(root), 'status'),
      '--json',
      '--command',
      "SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name='service_status'",
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  const result = JSON.parse(output) as Array<{ results: Array<{ count: number }> }>
  return result[0].results[0].count
}

try {
  await migrateStatusDatabase(rootA)
  assert.equal(query(rootA), 1)
  assert.equal(await workerRead(rootA), 1)
  assert.equal(query(rootB), 0)
  assert.equal(await workerRead(rootB), 0)
  await migrateStatusDatabase(rootA)
  await migrateStatusDatabase(rootB)
  assert.equal(query(rootA), 1)
  assert.equal(query(rootB), 1)
  assert.equal(await workerRead(rootB), 1)
  console.log('Status local D1 migration and checkout isolation passed.')
} finally {
  await rm(userDataRoot(rootA), { recursive: true, force: true })
  await rm(userDataRoot(rootB), { recursive: true, force: true })
  await rm(rootA, { recursive: true, force: true })
  await rm(rootB, { recursive: true, force: true })
}
