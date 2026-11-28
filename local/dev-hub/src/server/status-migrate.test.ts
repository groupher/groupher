import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { migrateStatusDatabase } from './status-migrate.ts'
import { workerStateRoot } from './storage-paths.ts'

test('Status migration refuses production markers before creating local state', async () => {
  const markers = ['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT'] as const
  const previous = Object.fromEntries(markers.map((key) => [key, process.env[key]]))
  const checkout = await mkdtemp(path.join(os.tmpdir(), 'status-migrate-guard-'))
  const state = path.join(workerStateRoot(checkout), 'status')
  try {
    assert.equal(existsSync(state), false)
    for (const marker of markers) {
      for (const key of markers) delete process.env[key]
      process.env[marker] = ' Production '
      await assert.rejects(migrateStatusDatabase(checkout), /production/)
      assert.equal(existsSync(state), false, `${marker} created Status state`)
    }
  } finally {
    for (const key of markers) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    await rm(checkout, { recursive: true, force: true })
  }
})
