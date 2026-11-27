import assert from 'node:assert/strict'
import test from 'node:test'

import { migrateStatusDatabase } from './status-migrate.ts'

test('Status migration refuses production markers before creating local state', async () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await assert.rejects(migrateStatusDatabase('/nonexistent-status-probe'), /production/)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})
