import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { databaseTargetForEnvironment } from './database-ownership.ts'
import { diagnoseEnvironment, diagnoseServiceDependencies } from './doctor.ts'
import {
  initializePrimary,
  markRunReady,
  registerCheckout,
  reserveRun,
} from './environment-registry.ts'
import { SERVICE_DEFINITIONS } from './services.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('service diagnosis follows the configured dependency chain and reports unavailable states', () => {
  const report = diagnoseServiceDependencies('dash', SERVICE_DEFINITIONS, [
    { id: 'dash', status: 'running', publicUrl: 'https://dash.example' },
    { id: 'phoenix', status: 'stopped' },
  ])
  assert.equal(report.target.status, 'running')
  assert.equal(report.required.find((item) => item.id === 'phoenix')?.status, 'stopped')
  assert.equal(report.conclusion.status, 'not-ready')
  assert.ok(report.conclusion.notReady.includes('phoenix'))
  assert.ok(report.conclusion.nextSteps.some((item) => item.includes('devhub start phoenix')))
  assert.equal(report.required.find((item) => item.id === 'auth')?.status, 'unknown')
  assert.ok(report.optional.some((item) => item.id === 'converter'))
  assert.throws(
    () => diagnoseServiceDependencies('does-not-exist', SERVICE_DEFINITIONS, []),
    /Unknown service/,
  )
  assert.equal(
    diagnoseServiceDependencies('dash', SERVICE_DEFINITIONS, null).target.status,
    'unknown',
  )
})

test('required paths take precedence over optional paths throughout the chain', () => {
  const base = SERVICE_DEFINITIONS.find((item) => item.id === 'dash')!
  const definition = (
    id: string,
    requiredDependencies: string[],
    optionalDependencies: string[],
  ) => ({
    ...base,
    id,
    startPolicy: { requiredDependencies, optionalDependencies },
  })
  const definitions = [
    definition('root', ['optional-first', 'required-path'], []),
    definition('optional-first', [], ['shared']),
    definition('required-path', ['shared'], []),
    definition('shared', ['nested'], []),
    definition('nested', [], []),
  ]
  const report = diagnoseServiceDependencies('root', definitions, [])
  assert.ok(report.required.some((item) => item.id === 'shared'))
  assert.ok(report.required.some((item) => item.id === 'nested'))
  assert.equal(
    report.optional.some((item) => ['shared', 'nested'].includes(item.id)),
    false,
  )
})

test('optional service summary distinguishes stopped, transitioning and unknown states', () => {
  const base = SERVICE_DEFINITIONS.find((item) => item.id === 'dash')!
  const ids = ['stopped', 'starting', 'unknown', 'external', 'running']
  const definitions = [
    { ...base, id: 'root', startPolicy: { optionalDependencies: ids } },
    ...ids.map((id) => ({ ...base, id, startPolicy: {} })),
  ]
  const report = diagnoseServiceDependencies(
    'root',
    definitions,
    ids.filter((id) => id !== 'unknown').map((id) => ({ id, status: id })),
  )
  assert.deepEqual(report.conclusion.optionalNotRunning, ['stopped'])
  assert.deepEqual(report.conclusion.optionalTransitioning, ['starting'])
  assert.deepEqual(report.conclusion.optionalUnknown, ['unknown', 'external'])
  const disconnected = diagnoseServiceDependencies('root', definitions, null)
  assert.deepEqual(disconnected.conclusion.optionalNotRunning, [])
  assert.deepEqual(disconnected.conclusion.optionalUnknown, ids)
})

test('doctor reports ownership and migration state without disclosing the claim', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'groupher-doctor-')))
  const root = path.join(base, 'primary')
  const directory = path.join(base, 'registry')
  try {
    execFileSync('git', ['init', '-q', root])
    const identity = await resolveCheckout(root)
    const environment = await initializePrimary(directory, identity)
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    await new Promise<void>((resolve) => server.close(() => resolve()))
    const run = await reserveRun(directory, identity, { ports: [port] })
    await markRunReady(directory, identity, run.instanceId, process.pid, new Date().toISOString())
    const seen: string[] = []
    const report = await diagnoseEnvironment(root, directory, {
      portless: async () => ({ mode: 'HTTPS' }),
      services: async () => [
        { id: 'dash', status: 'running', publicUrl: 'https://dash.groupher.localhost' },
      ],
      inspect: async (_root, purpose) => {
        seen.push(purpose)
        if (purpose === 'test') throw new Error('test target not registered')
        return {
          target: databaseTargetForEnvironment(environment, 'dev'),
          migrationCount: 1,
          versions: ['1'],
          pending: [{ version: '2', file: '2_pending.exs' }],
          unknown: [],
        }
      },
    })
    assert.deepEqual(seen, ['dev', 'test'])
    assert.equal(report.registration?.role, 'primary')
    assert.deepEqual(report.issues.map(({ component }) => component).sort(), [
      'database:test',
      'head',
    ])
    assert.equal(JSON.stringify(report).includes(environment.claimToken), false)
    assert.equal(report.databases.test, null)
    assert.ok(report.databases.dev)
    assert.deepEqual(report.services, [
      { id: 'dash', status: 'running', publicUrl: 'https://dash.groupher.localhost' },
    ])
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})

test('doctor reports removed and unverified checkouts without touching their data', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'groupher-doctor-retired-')))
  const root = path.join(base, 'primary')
  const removed = path.join(base, 'removed')
  const unverified = path.join(base, 'unverified')
  const directory = path.join(base, 'registry')
  try {
    for (const checkout of [root, removed, unverified])
      execFileSync('git', ['init', '-q', checkout])
    const primary = await initializePrimary(directory, await resolveCheckout(root))
    const removedEnvironment = await registerCheckout(directory, await resolveCheckout(removed))
    const changedEnvironment = await registerCheckout(directory, await resolveCheckout(unverified))
    const retainedMetrics = path.join(directory, removedEnvironment.worktreeId, 'metrics')
    await mkdir(retainedMetrics, { recursive: true })
    await writeFile(path.join(retainedMetrics, 'keep'), 'untouched')
    const unrelated = path.join(base, 'unrelated')
    await mkdir(path.join(unrelated, 'browsers'), { recursive: true })
    await symlink(unrelated, path.join(directory, changedEnvironment.worktreeId))
    await rm(removed, { recursive: true })
    await rm(path.join(unverified, 'local/dev-hub/config/checkout-claim.json'))
    const before = await readFile(path.join(directory, 'registry.json'), 'utf8')
    const report = await diagnoseEnvironment(root, directory, {
      portless: async () => ({}),
      inspect: async () => {
        throw new Error('not part of this diagnostic')
      },
    })
    const environments = report.environments as Array<{
      root: string
      ownership: string
      storage: { metrics: { path: string; state: string }; browsers: { state: string } }
    }>
    assert.equal(environments.find((item) => item.root === root)?.ownership, 'verified')
    const retired = environments.find((item) => item.root === removed)
    assert.equal(retired?.ownership, 'missing')
    assert.deepEqual(retired?.storage.metrics, { path: retainedMetrics, state: 'directory' })
    const changed = environments.find((item) => item.root === unverified)
    assert.equal(changed?.ownership, 'unverified')
    assert.equal(changed?.storage.browsers.state, 'unverified-parent')
    assert.equal(await readFile(path.join(retainedMetrics, 'keep'), 'utf8'), 'untouched')
    assert.equal(await readFile(path.join(directory, 'registry.json'), 'utf8'), before)
    const serialized = JSON.stringify(report)
    for (const environment of [primary, removedEnvironment, changedEnvironment])
      assert.equal(serialized.includes(environment.claimToken), false)
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})
