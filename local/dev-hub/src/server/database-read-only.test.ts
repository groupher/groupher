import assert from 'node:assert/strict'
import test from 'node:test'

import {
  openReadOnlyDatabase,
  readOnlyStatement,
  redactDatabaseError,
} from './database-read-only.ts'

test('read-only statements reject additional SQL and psql commands', () => {
  assert.equal(readOnlyStatement(' SELECT 1; '), 'SELECT 1')
  assert.equal(
    readOnlyStatement('WITH n AS (SELECT 1) SELECT * FROM n'),
    'WITH n AS (SELECT 1) SELECT * FROM n',
  )
  for (const sql of [
    'DELETE FROM t',
    'SELECT 1; DELETE FROM t',
    'SELECT 1\\gexec',
    '\\connect postgres',
  ]) {
    assert.throws(() => readOnlyStatement(sql), /one SELECT/)
  }
})

test('read-only inspection rejects production and ambiguous database overrides before setup', async () => {
  const root = '/nonexistent-read-only-target'
  for (const env of [
    { NODE_ENV: 'production' },
    { MIX_ENV: 'prod' },
    { DATABASE_URL: 'postgres://remote.example/database' },
    { PGHOST: 'remote.example' },
  ]) {
    await assert.rejects(
      openReadOnlyDatabase(root, 'dev', undefined, env),
      /local development|DATABASE_URL|PostgreSQL environment/,
    )
  }
})

test('database errors redact both administrator and temporary reader passwords', () => {
  assert.equal(
    redactDatabaseError('admin-secret reader-secret admin-secret', [
      'admin-secret',
      'reader-secret',
    ]),
    '[redacted] [redacted] [redacted]',
  )
})
