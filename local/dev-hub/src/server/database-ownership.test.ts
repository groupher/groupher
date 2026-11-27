import assert from 'node:assert/strict'
import test from 'node:test'

import {
  databaseCommentStatement,
  databaseTargetForEnvironment,
  parseDatabaseComment,
  resolveDatabaseTarget,
  validateDatabaseTarget,
  verifyDatabaseOwnership,
  type TDatabaseTarget,
} from './database-ownership.ts'

const target: TDatabaseTarget = {
  hostname: '127.0.0.1',
  port: 5432,
  database: 'groupher_test_b',
  worktreeId: '0123456789abcdef',
  purpose: 'test',
}
const marker = {
  namespace: 'groupher-devhub',
  formatVersion: 1,
  worktreeId: target.worktreeId,
  purpose: 'test',
  previousComment: 'prior comment',
}

test('database allocation is stable, bounded and isolates checkouts and purposes', () => {
  const environment = {
    role: 'secondary' as const,
    slug: 'a-very-long-feature-name-with-extra-components',
    worktreeId: '0123456789abcdef',
  }
  const dev = databaseTargetForEnvironment(environment, 'dev')
  assert.deepEqual(dev, databaseTargetForEnvironment(environment, 'dev'))
  assert.ok(dev.database.length <= 63)
  assert.notEqual(dev.database, databaseTargetForEnvironment(environment, 'test').database)
  assert.notEqual(
    dev.database,
    databaseTargetForEnvironment({ ...environment, worktreeId: 'fedcba9876543210' }, 'dev')
      .database,
  )
  assert.equal(
    databaseTargetForEnvironment({ ...environment, role: 'primary' }, 'dev').database,
    'groupher_server_dev',
  )
})

test('accepts a matching local target and retains the prior comment', () => {
  const comment = JSON.stringify(marker)
  assert.deepEqual(
    verifyDatabaseOwnership(target, {
      database: target.database,
      hostname: '127.0.0.1',
      port: 5432,
      comment,
    }),
    marker,
  )
  assert.equal(parseDatabaseComment('ordinary comment'), null)
  assert.equal(parseDatabaseComment(null), null)
})

test('rejects remote targets, wrong databases, unknown formats and mismatched ownership', () => {
  const actual = {
    database: target.database,
    hostname: '127.0.0.1',
    port: 5432,
    comment: JSON.stringify(marker),
  }
  assert.throws(() => validateDatabaseTarget({ ...target, hostname: 'db.example.com' }))
  assert.throws(() => validateDatabaseTarget({ ...target, database: 'test;drop database x' }))
  assert.throws(() => verifyDatabaseOwnership(target, { ...actual, database: 'other' }))
  assert.throws(() =>
    verifyDatabaseOwnership(target, {
      ...actual,
      comment: JSON.stringify({ ...marker, worktreeId: 'ffffffffffffffff' }),
    }),
  )
  assert.throws(() => parseDatabaseComment(JSON.stringify({ ...marker, formatVersion: 2 })))
  assert.throws(() => parseDatabaseComment('{"namespace":"groupher-devhub"'))
  assert.throws(() => verifyDatabaseOwnership(target, { ...actual, comment: null }))
})

test('rehearsals require a run and comment literals escape quotes and backslashes', () => {
  assert.throws(() => validateDatabaseTarget({ ...target, purpose: 'rehearsal' }))
  assert.throws(() => validateDatabaseTarget({ ...target, purpose: 'test', run: 'demo' }))
  const statement = databaseCommentStatement(
    { ...target, purpose: 'rehearsal', run: 'demo' },
    "O'Reilly \\ path",
  )
  assert.match(statement, /^COMMENT ON DATABASE "groupher_test_b" IS E'/)
  assert.ok(statement.includes("O''Reilly"))
  assert.ok(statement.includes('\\\\\\\\'))
})

test('checkout target resolution rejects stale registration and conflicting overrides', () => {
  const file = {
    version: 1 as const,
    worktreeId: target.worktreeId,
    targets: { test: { hostname: target.hostname, port: target.port, database: target.database } },
  }
  assert.deepEqual(resolveDatabaseTarget(file, target.worktreeId, 'test', {}), target)
  assert.throws(() => resolveDatabaseTarget(file, 'ffffffffffffffff', 'test', {}), /checkout/)
  assert.throws(() => resolveDatabaseTarget(file, target.worktreeId, 'dev', {}), /not registered/)
  assert.throws(
    () =>
      resolveDatabaseTarget(file, target.worktreeId, 'test', {
        TEST_DB_NAME: 'groupher_server_test',
      }),
    /Conflicting/,
  )
  assert.throws(
    () =>
      resolveDatabaseTarget(file, target.worktreeId, 'test', {
        DATABASE_URL: 'postgres://remote/db',
      }),
    /DATABASE_URL/,
  )
  assert.throws(
    () => resolveDatabaseTarget(file, target.worktreeId, 'test', { MIX_ENV: 'prod' }),
    /local development/,
  )
})
