import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { adoptPrimaryDatabase, parsePrimaryAdoptionOptions } from './database-adopt-primary.ts'
import { createManagedDatabase } from './database-create.ts'
import { dropManagedDatabase } from './database-drop.ts'
import { inspectManagedDatabase } from './database-inspect.ts'
import { migrateManagedDatabase } from './database-migrate.ts'
import {
  databaseCommentStatement,
  databaseTargetForEnvironment,
  verifyDatabaseOwnership,
} from './database-ownership.ts'
import { initializePrimary, registerCheckout, reserveRun } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('primary adoption target and reversal options are explicit and unambiguous', () => {
  assert.deepEqual(parsePrimaryAdoptionOptions([]), { purpose: 'dev', revert: false })
  assert.deepEqual(parsePrimaryAdoptionOptions(['--revert', '--target', 'test']), {
    purpose: 'test',
    revert: true,
  })
  assert.throws(() => parsePrimaryAdoptionOptions(['--target', 'test', '--target', 'dev']))
  assert.throws(() => parsePrimaryAdoptionOptions(['--target', 'production']))
  assert.throws(() => parsePrimaryAdoptionOptions(['--revert', '--revert']))
})

test('provisioning records only databases with matching ownership', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'groupher-db-create-test-'))
  try {
    const primary = path.join(temp, 'primary')
    const secondary = path.join(temp, 'secondary')
    execFileSync('git', ['init', '-q', primary])
    execFileSync('git', ['init', '-q', secondary])
    const registry = path.join(temp, 'registry')
    await initializePrimary(registry, await resolveCheckout(primary))
    const primaryMigrations = path.join(primary, 'backend/api/priv/repo/migrations')
    await mkdir(primaryMigrations, { recursive: true })
    await writeFile(path.join(primaryMigrations, '20261126000000_pending.exs'), '')
    const primaryStatus = await inspectManagedDatabase(
      primary,
      'test',
      registry,
      {},
      async (database, sql) => {
        assert.equal(database, 'target')
        if (sql.includes('current_database()'))
          return JSON.stringify({
            database: 'groupher_server_test',
            port: 5432,
            address: '127.0.0.1',
            comment: null,
          })
        if (sql.includes('to_regclass')) return 'f'
        throw new Error('Unexpected SQL')
      },
    )
    assert.equal(primaryStatus.target.database, 'groupher_server_test')
    assert.deepEqual(primaryStatus.pending, [
      { version: '20261126000000', file: '20261126000000_pending.exs' },
    ])
    await assert.rejects(
      inspectManagedDatabase(
        primary,
        'test',
        registry,
        { TEST_DB_HOST: 'localhost' },
        async (database) => {
          assert.equal(database, 'target')
          return JSON.stringify({
            database: 'groupher_server_test',
            port: 5432,
            address: '127.0.0.1',
            comment: JSON.stringify({
              namespace: 'groupher-devhub',
              formatVersion: 1,
              worktreeId: (await resolveCheckout(primary)).worktreeId,
              purpose: 'test',
              previousComment: null,
            }),
          })
        },
      ),
      /adoption record is unavailable/,
    )
    await assert.rejects(
      inspectManagedDatabase(primary, 'test', registry, {}, async () =>
        JSON.stringify({
          database: 'groupher_server_test',
          port: 5432,
          address: '192.0.2.1',
          comment: null,
        }),
      ),
      /does not match the local target/,
    )
    await assert.rejects(
      inspectManagedDatabase(primary, 'test', registry, { TEST_DB_NAME: 'other' }, async () => {
        throw new Error('a conflicting target must be rejected before connecting')
      }),
      /Conflicting TEST_DB_NAME/,
    )
    const guard = path.resolve('../../backend/api/config/linked_checkout_guard.exs')
    const resolvePrimary = () =>
      execFileSync(
        'elixir',
        [
          '-r',
          guard,
          '-e',
          '[root, registry] = System.argv(); IO.inspect(GroupherLinkedCheckoutGuard.resolve!(root, :test, registry))',
          '--',
          primary,
          registry,
        ],
        { env: { PATH: process.env.PATH }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim()
    assert.equal(resolvePrimary(), 'nil')
    const primaryClaim = path.join(primary, 'local/dev-hub/config/checkout-claim.json')
    await rename(primaryClaim, `${primaryClaim}.test-backup`)
    try {
      assert.throws(resolvePrimary, /Missing managed database configuration/)
    } finally {
      await rename(`${primaryClaim}.test-backup`, primaryClaim)
    }
    let primaryComment: string | null = "owner's original note"
    let primaryWrites = 0
    const primaryQuery = async (sql: string) => {
      if (sql.startsWith('SELECT')) {
        return JSON.stringify({ database: 'groupher_server_dev', comment: primaryComment })
      }
      if (!sql.startsWith('COMMENT ON DATABASE')) throw new Error('Unexpected SQL')
      primaryWrites++
      if (sql.includes('groupher-devhub')) {
        const marker = {
          namespace: 'groupher-devhub',
          formatVersion: 1,
          worktreeId: (await resolveCheckout(primary)).worktreeId,
          purpose: 'dev',
          previousComment: "owner's original note",
        }
        primaryComment = JSON.stringify(marker)
      } else {
        assert.ok(sql.includes("owner''s original note"))
        primaryComment = "owner's original note"
      }
      return ''
    }
    assert.equal(
      (await adoptPrimaryDatabase(primary, false, registry, {}, primaryQuery)).adopted,
      true,
    )
    assert.equal(
      (await adoptPrimaryDatabase(primary, false, registry, {}, primaryQuery)).adopted,
      true,
    )
    assert.equal(primaryWrites, 1)
    const primaryMigration = await migrateManagedDatabase(
      primary,
      'dev',
      registry,
      {},
      async (_root, _purpose, _environment, task) => ({ stdout: task, stderr: '' }),
      primaryQuery,
    )
    assert.equal(primaryMigration.status, 'complete')
    assert.equal(
      (await adoptPrimaryDatabase(primary, true, registry, {}, primaryQuery)).adopted,
      false,
    )
    assert.equal(primaryComment, "owner's original note")
    assert.equal(
      (await adoptPrimaryDatabase(primary, true, registry, {}, primaryQuery)).adopted,
      false,
    )
    assert.equal(primaryWrites, 2)
    await assert.rejects(
      adoptPrimaryDatabase(primary, false, registry, { DB_HOST: 'db.example.com' }, primaryQuery),
      /local development/,
    )
    primaryComment = 'changed by another process'
    await assert.rejects(
      adoptPrimaryDatabase(primary, false, registry, {}, primaryQuery),
      /differs from the adoption record/,
    )
    assert.equal(primaryWrites, 2)
    const identity = await resolveCheckout(secondary)
    const registered = await registerCheckout(registry, identity)
    const target = databaseTargetForEnvironment(registered, 'test')
    let present = false
    let comment: string | null = null
    const execute = async (sql: string) => {
      if (sql.startsWith('SELECT')) {
        return present ? JSON.stringify({ database: target.database, comment }) : ''
      }
      if (sql.startsWith('CREATE DATABASE')) {
        assert.equal(present, false)
        present = true
        return ''
      }
      if (sql.startsWith('COMMENT ON DATABASE')) {
        comment = sql.match(/ IS E'(.*)'$/)?.[1] || null
        return ''
      }
      throw new Error('Unexpected SQL')
    }
    assert.equal(
      (await createManagedDatabase(secondary, 'test', registry, {}, execute)).created,
      true,
    )
    assert.equal(
      (await createManagedDatabase(secondary, 'test', registry, {}, execute)).created,
      false,
    )
    const file = JSON.parse(
      await readFile(path.join(secondary, 'local/dev-hub/config/database-target.json'), 'utf8'),
    )
    assert.equal(file.targets.test.database, target.database)
    const migrations = path.join(secondary, 'backend/api/priv/repo/migrations')
    await mkdir(migrations, { recursive: true })
    await writeFile(path.join(migrations, '20261119090000_done.exs'), '')
    await writeFile(path.join(migrations, '20261126000000_pending.exs'), '')
    const inspected = await inspectManagedDatabase(
      secondary,
      'test',
      registry,
      {},
      async (database, sql) => {
        if (database === 'admin') return execute(sql)
        if (sql.includes('to_regclass')) return 't'
        return JSON.stringify(['20261119090000', '20261125100000'])
      },
    )
    assert.equal(inspected.migrationCount, 2)
    assert.deepEqual(inspected.pending, [
      { version: '20261126000000', file: '20261126000000_pending.exs' },
    ])
    assert.deepEqual(inspected.unknown, ['20261125100000'])
    let called = 0
    const run = async (
      _root: string,
      _purpose: 'dev' | 'test',
      _environment: NodeJS.ProcessEnv,
      task: string,
    ) => {
      called++
      return { stdout: task === 'ecto.migrate' ? 'migrated' : 'version list', stderr: '' }
    }
    const migration = await migrateManagedDatabase(secondary, 'test', registry, {}, run, execute)
    assert.equal(migration.output, 'migrated')
    assert.equal(migration.versions, 'version list')
    await assert.rejects(
      migrateManagedDatabase(secondary, 'test', registry, { MIX_ENV: 'dev' }, run),
      /MIX_ENV/,
    )
    assert.equal(called, 2)
    const lock = path.join(secondary, 'local/dev-hub/config/database-create.lock')
    await mkdir(lock)
    try {
      await assert.rejects(reserveRun(registry, identity), /database operation/)
    } finally {
      await rm(lock, { recursive: true })
    }
    comment = null
    await assert.rejects(
      createManagedDatabase(secondary, 'test', registry, {}, execute),
      /ownership marker/,
    )
    await assert.rejects(
      createManagedDatabase(primary, 'dev', registry, {}, execute),
      /explicit adoption/,
    )
    comment = JSON.stringify({
      namespace: 'groupher-devhub',
      formatVersion: 1,
      worktreeId: identity.worktreeId,
      purpose: 'test',
      previousComment: null,
    })
    let cleaned = false
    const dropQuery = async (database: 'admin' | 'target', sql: string) => {
      if (database === 'admin' && sql.startsWith('SELECT')) {
        return present ? JSON.stringify({ database: target.database, comment }) : ''
      }
      if (database === 'target' && sql.includes('to_regclass')) return 't'
      if (database === 'target')
        return JSON.stringify([
          {
            run: 'example',
            alias: 'owner',
            status: 'closed',
            cleanupStatus: cleaned ? 'cleaned' : null,
            report: cleaned
              ? {
                  admins_to_remove: 0,
                  coauthors: 0,
                  global_grants_to_restore: 0,
                  pending_requests: 0,
                  blockers: [],
                  communities_to_archive: [],
                }
              : null,
          },
        ])
      if (database === 'admin' && sql.startsWith('DROP DATABASE')) {
        present = false
        return ''
      }
      throw new Error('Unexpected SQL')
    }
    await assert.rejects(
      dropManagedDatabase(secondary, 'test', registry, {}, path.join(temp, 'reports'), dropQuery),
      /cleanup is incomplete/,
    )
    cleaned = true
    const dropped = await dropManagedDatabase(
      secondary,
      'test',
      registry,
      {},
      path.join(temp, 'reports'),
      dropQuery,
    )
    assert.equal(dropped.alreadyDropped, false)
    assert.ok(dropped.cleanupReport)
    assert.equal(
      (
        await dropManagedDatabase(
          secondary,
          'test',
          registry,
          {},
          path.join(temp, 'reports'),
          dropQuery,
        )
      ).alreadyDropped,
      true,
    )
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test(
  'creates and reuses an isolated marked local database',
  { skip: process.env.GROUPHER_DB_PROVISION_INTEGRATION !== '1' },
  async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), 'groupher-db-create-integration-'))
    const primary = path.join(temp, 'primary')
    const secondary = path.join(temp, 'secondary')
    const registry = path.join(temp, 'registry')
    let target: ReturnType<typeof databaseTargetForEnvironment> | undefined
    const psql = (sql: string) =>
      execFileSync(
        'psql',
        [
          '-X',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
          '-h',
          '127.0.0.1',
          '-p',
          '5432',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-c',
          sql,
        ],
        { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' },
      ).trim()
    try {
      execFileSync('git', ['init', '-q', primary])
      execFileSync('git', ['init', '-q', secondary])
      await initializePrimary(registry, await resolveCheckout(primary))
      const identity = await resolveCheckout(secondary)
      const registered = await registerCheckout(registry, identity)
      target = databaseTargetForEnvironment(registered, 'test')
      await createManagedDatabase(secondary, 'test', registry, { PATH: process.env.PATH })
      await createManagedDatabase(secondary, 'test', registry, { PATH: process.env.PATH })
      const guard = path.resolve('../../backend/api/config/linked_checkout_guard.exs')
      const check = (extraEnv: NodeJS.ProcessEnv = {}) =>
        execFileSync(
          'elixir',
          [
            '-r',
            guard,
            '-e',
            '[root, _common, registry] = System.argv(); result = GroupherLinkedCheckoutGuard.resolve!(root, :test, registry); IO.puts(Keyword.fetch!(result, :database))',
            '--',
            secondary,
            identity.commonDir,
            registry,
          ],
          {
            env: { PATH: process.env.PATH, ...extraEnv },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        ).trim()
      assert.equal(check(), target.database)
      assert.throws(() => check({ TEST_DB_NAME: 'groupher_server_test' }), /Conflicting/)
      assert.throws(() => check({ MIX_BUILD_PATH: '/tmp/other-build' }), /must belong/)
      assert.throws(
        () => check({ ASSETS_HUB_DELETE_ENDPOINT: 'https://assets.groupher.com' }),
        /does not belong/,
      )
      assert.throws(
        () => check({ ASSETS_PUBLIC_ENDPOINT: 'https://assets.groupher.com' }),
        /does not belong/,
      )
      try {
        psql(`COMMENT ON DATABASE "${target.database}" IS NULL`)
        assert.throws(() => check(), /Invalid managed database configuration|ownership marker/)
      } finally {
        psql(databaseCommentStatement(target, null))
      }
      const comment = psql(
        `SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${target.database}'`,
      )
      verifyDatabaseOwnership(target, { ...target, comment })
      const dropped = await dropManagedDatabase(
        secondary,
        'test',
        registry,
        { PATH: process.env.PATH },
        path.join(temp, 'reports'),
      )
      assert.equal(dropped.alreadyDropped, false)
      assert.equal(
        (
          await dropManagedDatabase(
            secondary,
            'test',
            registry,
            { PATH: process.env.PATH },
            path.join(temp, 'reports'),
          )
        ).alreadyDropped,
        true,
      )
    } finally {
      if (target) {
        const comment = psql(
          `SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${target.database}'`,
        )
        if (comment) {
          verifyDatabaseOwnership(target, { ...target, comment })
          psql(`DROP DATABASE "${target.database}"`)
        }
      }
      await rm(temp, { recursive: true, force: true })
    }
  },
)
