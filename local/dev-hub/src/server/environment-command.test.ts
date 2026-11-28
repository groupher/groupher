import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createManagedDatabase } from './database-create.ts'
import { runEnvironmentCommand } from './environment-command.ts'
import { releaseRun, reserveRun } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('environment command initializes and reuses the current Git checkout without exposing its claim', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-env-command-')))
  const root = path.join(base, 'groupher-main')
  const registry = path.join(base, 'registry')
  try {
    await mkdir(root)
    execFileSync('git', ['init', '-q', root])
    await assert.rejects(
      runEnvironmentCommand(['register'], root, registry, {}),
      /Primary identity/,
    )
    const initialized = (await runEnvironmentCommand(
      ['init-primary'],
      root,
      registry,
      {},
    )) as Record<string, unknown>
    assert.equal(initialized.root, root)
    assert.equal(initialized.role, 'primary')
    assert.equal('claimToken' in initialized, false)
    assert.deepEqual(await runEnvironmentCommand(['register'], root, registry, {}), initialized)
    await assert.rejects(
      runEnvironmentCommand(['register'], root, registry, { CI: 'true' }),
      /local development/,
    )
    await assert.rejects(
      runEnvironmentCommand(['register'], root, registry, { MIX_ENV: 'prod' }),
      /local development/,
    )
    await assert.rejects(
      runEnvironmentCommand(['register', '--force'], root, registry, {}),
      /Usage/,
    )
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})

test('retirement preserves a checkout while either database exists or cannot be checked', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-env-retire-')))
  const primary = path.join(base, 'primary')
  const secondary = path.join(base, 'secondary')
  const registry = path.join(base, 'registry')
  try {
    execFileSync('git', ['init', '-q', primary])
    execFileSync('git', ['init', '-q', secondary])
    await runEnvironmentCommand(['init-primary'], primary, registry, {})
    await runEnvironmentCommand(['register'], secondary, registry, {})
    const identity = await resolveCheckout(secondary)
    const run = await reserveRun(registry, identity)
    await assert.rejects(
      runEnvironmentCommand(['retire'], secondary, registry, {}, async () => ''),
      /Stop the environment/,
    )
    await releaseRun(registry, identity, run.instanceId)
    await assert.rejects(
      runEnvironmentCommand(['retire'], primary, registry, {}, async () => ''),
      /Cannot retire the primary/,
    )
    await assert.rejects(
      runEnvironmentCommand(
        ['retire'],
        secondary,
        registry,
        { NODE_ENV: 'production' },
        async () => {
          throw new Error('production must be rejected before connecting')
        },
      ),
      /local development/,
    )
    await assert.rejects(
      runEnvironmentCommand(
        ['retire'],
        secondary,
        registry,
        { DB_HOST: 'remote.example' },
        async () => {
          throw new Error('remote targets must be rejected before connecting')
        },
      ),
      /local|Conflicting/,
    )
    await assert.rejects(
      runEnvironmentCommand(['retire'], secondary, registry, {}, async (database) => database),
      /still exists/,
    )
    await assert.rejects(
      runEnvironmentCommand(['retire'], secondary, registry, {}, async (database) =>
        database.endsWith('_test') ? database : '',
      ),
      /still exists/,
    )
    await assert.rejects(
      runEnvironmentCommand(['retire'], secondary, registry, {}, async () => {
        throw new Error('database unavailable')
      }),
      /database unavailable/,
    )
    const checked: string[] = []
    let releaseCheck!: () => void
    let announceCheck!: () => void
    const checkStarted = new Promise<void>((resolve) => {
      announceCheck = resolve
    })
    const continueCheck = new Promise<void>((resolve) => {
      releaseCheck = resolve
    })
    const retirement = runEnvironmentCommand(['retire'], secondary, registry, {}, async (db) => {
      checked.push(db)
      if (checked.length === 1) {
        announceCheck()
        await continueCheck
      }
      return ''
    })
    await checkStarted
    let databaseQueries = 0
    const creation = createManagedDatabase(secondary, 'dev', registry, {}, async () => {
      databaseQueries += 1
      return ''
    })
    releaseCheck()
    const result = await retirement
    await assert.rejects(creation, /not registered|identity changed/)
    assert.equal(databaseQueries, 0)
    assert.equal((result as { retired: boolean }).retired, true)
    assert.equal(checked.length, 2)
    assert.match(checked[0], /_dev$/)
    assert.match(checked[1], /_test$/)
    assert.equal(
      ((await runEnvironmentCommand(['register'], secondary, registry, {})) as { role: string })
        .role,
      'secondary',
    )
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})
