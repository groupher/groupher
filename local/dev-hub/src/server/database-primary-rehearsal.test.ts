import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { adoptPrimaryDatabase } from './database-adopt-primary.ts'
import { createManagedDatabase } from './database-create.ts'
import { dropManagedDatabase } from './database-drop.ts'
import { inspectManagedDatabase } from './database-inspect.ts'
import { verifyManagedDatabase } from './database-ready.ts'
import { runEnvironmentCommand } from './environment-command.ts'
import { initializePrimary, registerCheckout } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

test(
  'primary adoption and secondary cleanup preserve the primary database',
  { skip: process.env.GROUPHER_PRIMARY_REHEARSAL !== '1', timeout: 120_000 },
  async () => {
    const base = await realpath(await mkdtemp(path.join(tmpdir(), 'groupher-primary-rehearsal-')))
    const data = path.join(base, 'postgres')
    const checkout = path.join(base, 'checkout')
    const registry = path.join(base, 'registry')
    const server = createServer()
    let started = false
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as { port: number }).port
      await new Promise<void>((resolve) => server.close(() => resolve()))
      execFileSync('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-instructions'], {
        stdio: 'ignore',
      })
      execFileSync(
        'pg_ctl',
        [
          '-D',
          data,
          '-l',
          path.join(base, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${port}`,
          '-w',
          'start',
        ],
        {
          stdio: 'ignore',
        },
      )
      started = true
      const query = (database: string, sql: string) =>
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
            String(port),
            '-U',
            'postgres',
            '-d',
            database,
            '-c',
            sql,
          ],
          { encoding: 'utf8' },
        ).trim()
      assert.equal(query('postgres', 'SHOW port'), String(port))
      query('postgres', 'CREATE DATABASE groupher_server_dev')
      query('postgres', 'CREATE DATABASE groupher_server_test')
      query('postgres', "COMMENT ON DATABASE groupher_server_dev IS 'original rehearsal comment'")
      query('postgres', "COMMENT ON DATABASE groupher_server_test IS 'original test comment'")
      query('groupher_server_dev', 'CREATE TABLE adoption_probe (value text)')
      query('groupher_server_dev', "INSERT INTO adoption_probe VALUES ('preserved')")
      query('groupher_server_test', 'CREATE TABLE adoption_probe (value text)')
      query('groupher_server_test', "INSERT INTO adoption_probe VALUES ('test-preserved')")
      execFileSync('git', ['init', '-q', checkout])
      const identity = await resolveCheckout(checkout)
      await initializePrimary(registry, identity)
      // The test adapter connects only to the disposable instance above; normal
      // production code always pins the registered target to local port 5432.
      const execute = async (sql: string) => query('postgres', sql)
      await adoptPrimaryDatabase(checkout, false, registry, {}, execute)
      await adoptPrimaryDatabase(checkout, false, registry, {}, execute)
      assert.equal(query('groupher_server_dev', 'SELECT value FROM adoption_probe'), 'preserved')
      const comment = JSON.parse(
        query(
          'postgres',
          "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='groupher_server_dev'",
        ),
      )
      assert.equal(comment.worktreeId, identity.worktreeId)
      assert.equal(comment.previousComment, 'original rehearsal comment')
      await adoptPrimaryDatabase(checkout, false, registry, {}, execute, 'test')
      await adoptPrimaryDatabase(checkout, false, registry, {}, execute, 'test')
      const testComment = JSON.parse(
        query(
          'postgres',
          "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='groupher_server_test'",
        ),
      )
      assert.equal(testComment.worktreeId, identity.worktreeId)
      assert.equal(testComment.purpose, 'test')
      assert.equal(testComment.previousComment, 'original test comment')
      assert.equal(
        (await verifyManagedDatabase(checkout, 'test', registry, {}, execute)).database,
        'groupher_server_test',
      )
      await mkdir(path.join(checkout, 'backend/api/priv/repo/migrations'), { recursive: true })
      const inspected = await inspectManagedDatabase(
        checkout,
        'test',
        registry,
        {},
        async (database, sql) => {
          if (database === 'admin') return execute(sql)
          if (sql.includes('current_database()'))
            return JSON.stringify({
              database: 'groupher_server_test',
              port: 5432,
              address: '127.0.0.1',
              comment: JSON.stringify(testComment),
            })
          if (sql.includes('to_regclass')) return 'f'
          throw new Error('Unexpected target query')
        },
      )
      assert.equal(inspected.target.database, 'groupher_server_test')
      await assert.rejects(
        dropManagedDatabase(checkout, 'test', registry, {}, path.join(base, 'reports')),
        /primary database cannot be dropped/,
      )
      await assert.rejects(
        adoptPrimaryDatabase(
          checkout,
          false,
          registry,
          { TEST_DB_HOST: 'remote.example' },
          execute,
          'test',
        ),
        /local development/,
      )
      await adoptPrimaryDatabase(checkout, true, registry, {}, execute, 'test')
      await adoptPrimaryDatabase(checkout, true, registry, {}, execute, 'test')
      await assert.rejects(
        verifyManagedDatabase(checkout, 'test', registry, {}, execute),
        /adoption cannot be verified/,
      )
      assert.equal(
        query('groupher_server_test', 'SELECT value FROM adoption_probe'),
        'test-preserved',
      )
      assert.equal(
        query(
          'postgres',
          "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='groupher_server_test'",
        ),
        'original test comment',
      )
      assert.equal(
        JSON.parse(
          query(
            'postgres',
            "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='groupher_server_dev'",
          ),
        ).purpose,
        'dev',
      )
      await adoptPrimaryDatabase(checkout, true, registry, {}, execute)
      await adoptPrimaryDatabase(checkout, true, registry, {}, execute)
      assert.equal(query('groupher_server_dev', 'SELECT value FROM adoption_probe'), 'preserved')
      assert.equal(
        query(
          'postgres',
          "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='groupher_server_dev'",
        ),
        'original rehearsal comment',
      )
      const secondary = path.join(base, 'secondary')
      execFileSync('git', ['init', '-q', secondary])
      await registerCheckout(registry, await resolveCheckout(secondary))
      const created = await createManagedDatabase(secondary, 'dev', registry, {}, execute)
      const secondaryDb = created.target.database
      const inspectDatabase = async (_database: string, sql: string) => query('postgres', sql)
      await assert.rejects(
        runEnvironmentCommand(['retire'], secondary, registry, {}, inspectDatabase),
        /still exists/,
      )
      query(secondaryDb, 'CREATE SCHEMA account')
      query(secondaryDb, 'CREATE TABLE account.oauth_providers (provider text, raw jsonb)')
      query(
        secondaryDb,
        `INSERT INTO account.oauth_providers VALUES ('local-test-actor-v1', '{"run":"demo","alias":"owner","status":"active"}')`,
      )
      const dropQuery = async (database: 'admin' | 'target', sql: string) =>
        query(database === 'admin' ? 'postgres' : secondaryDb, sql)
      await assert.rejects(
        dropManagedDatabase(secondary, 'dev', registry, {}, path.join(base, 'reports'), dropQuery),
        /cleanup is incomplete/,
      )
      query(
        secondaryDb,
        `UPDATE account.oauth_providers SET raw = '{"run":"demo","alias":"owner","status":"closed","cleanup_status":"cleaned","cleanup_report":{"admins_to_remove":0,"coauthors":0,"global_grants_to_restore":0,"pending_requests":0,"blockers":[],"communities_to_archive":[]}}'`,
      )
      const dropped = await dropManagedDatabase(
        secondary,
        'dev',
        registry,
        {},
        path.join(base, 'reports'),
        dropQuery,
      )
      assert.equal(dropped.alreadyDropped, false)
      assert.equal(
        (
          (await runEnvironmentCommand(['retire'], secondary, registry, {}, inspectDatabase)) as {
            retired: boolean
          }
        ).retired,
        true,
      )
      assert.equal(query('groupher_server_dev', 'SELECT value FROM adoption_probe'), 'preserved')
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
      if (started)
        execFileSync('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
      await rm(base, { recursive: true, force: true })
    }
  },
)
