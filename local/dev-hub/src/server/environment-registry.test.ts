import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCheckoutClaim } from './checkout-claim.ts'
import {
  initializePrimary,
  markRunReady,
  registerCheckout,
  releaseRun,
  reserveRun,
  verifyStartingRun,
} from './environment-registry.ts'
import type { TCheckoutIdentity } from './worktree-identity.ts'

function fixtures(dir: string) {
  const main: TCheckoutIdentity = {
    root: path.join(dir, 'main'),
    commonDir: path.join(dir, 'main', '.git'),
    mainRoot: path.join(dir, 'main'),
    isMainWorktree: true,
    worktreeId: 'aaaaaaaaaaaaaaaa',
  }
  const branch = (name: string, id: string): TCheckoutIdentity => ({
    root: path.join(dir, name),
    commonDir: main.commonDir,
    mainRoot: main.root,
    isMainWorktree: false,
    worktreeId: id,
  })
  return { main, branch }
}

test('registration serializes concurrent writes and preserves primary identity', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main, branch } = fixtures(dir)
  await mkdir(main.root)
  try {
    assert.equal((await initializePrimary(dir, main)).role, 'primary')
    assert.deepEqual(await initializePrimary(dir, main), await registerCheckout(dir, main))
    await mkdir(path.join(dir, 'groupher-test'))
    await mkdir(path.join(dir, 'test'))
    const [first, second] = await Promise.all([
      registerCheckout(dir, branch('groupher-test', 'bbbbbbbbbbbbbbbb')),
      registerCheckout(dir, branch('test', 'cccccccccccccccc')),
    ])
    assert.notEqual(first.slug, second.slug)
    await assert.rejects(
      reserveRun(dir, branch('test', 'cccccccccccccccc'), { mode: 'full' }),
      /Secondary full mode/,
    )
    const registry = JSON.parse(await readFile(path.join(dir, 'registry.json'), 'utf8'))
    assert.equal(registry.environments.length, 3)
    assert.equal((await stat(path.join(dir, 'registry.json'))).mode & 0o777, 0o600)
    assert.equal((await stat(dir)).mode & 0o777, 0o700)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('parallel environments reserve distinct product ports under the registry lock', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-service-ports-')))
  const { main, branch } = fixtures(dir)
  const secondary = branch('other', 'bbbbbbbbbbbbbbbb')
  const listeners = Array.from({ length: 6 }, () => createServer())
  await mkdir(main.root)
  await mkdir(secondary.root)
  try {
    await initializePrimary(dir, main)
    await registerCheckout(dir, secondary)
    for (const listener of listeners)
      await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve))
    const ports = listeners.map((listener) => (listener.address() as { port: number }).port)
    for (const listener of listeners)
      await new Promise<void>((resolve) => listener.close(() => resolve()))
    const options = {
      ports: ports.slice(0, 2),
      serviceIds: ['phoenix', 'auth'],
      servicePortPool: ports.slice(2),
    }
    const [a, b] = await Promise.all([
      reserveRun(dir, main, options),
      reserveRun(dir, secondary, options),
    ])
    const allPorts = [
      a.port,
      b.port,
      ...Object.values(a.servicePorts!),
      ...Object.values(b.servicePorts!),
    ]
    assert.equal(new Set(allPorts).size, 6)
    await new Promise<void>((resolve) =>
      listeners[0].listen(a.servicePorts!.phoenix, '127.0.0.1', resolve),
    )
    await assert.rejects(releaseRun(dir, main, a.instanceId), /product service port/)
    await new Promise<void>((resolve) => listeners[0].close(() => resolve()))
    await releaseRun(dir, main, a.instanceId)
    await releaseRun(dir, secondary, b.instanceId)
  } finally {
    for (const listener of listeners)
      if (listener.listening) await new Promise<void>((resolve) => listener.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('corrupt registry and changed checkout identity fail without replacing files', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main, branch } = fixtures(dir)
  await mkdir(main.root)
  try {
    await initializePrimary(dir, main)
    await mkdir(path.join(dir, 'other'))
    await registerCheckout(dir, branch('other', 'bbbbbbbbbbbbbbbb'))
    await assert.rejects(registerCheckout(dir, branch('other', 'cccccccccccccccc')), /ownership/)
    const file = path.join(dir, 'registry.json')
    await writeFile(file, '{broken')
    await assert.rejects(registerCheckout(dir, branch('new', 'dddddddddddddddd')), /preserve/)
    assert.equal(await readFile(file, 'utf8'), '{broken')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('primary initialization recovers after primary identity was written but registry was not', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main, branch } = fixtures(dir)
  await mkdir(main.root)
  try {
    const claimToken = await createCheckoutClaim(main.root, main.worktreeId)
    await writeFile(
      path.join(dir, 'primary.json'),
      JSON.stringify({ version: 1, root: main.root, commonDir: main.commonDir, claimToken }),
    )
    assert.equal((await initializePrimary(dir, main)).root, main.root)
    const registry = JSON.parse(await readFile(path.join(dir, 'registry.json'), 'utf8'))
    assert.equal(registry.environments.length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('well-formed but invalid registry contents are preserved and rejected', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main, branch } = fixtures(dir)
  await mkdir(main.root)
  try {
    await initializePrimary(dir, main)
    const file = path.join(dir, 'registry.json')
    const original = JSON.parse(await readFile(file, 'utf8'))
    const duplicate = JSON.stringify({
      ...original,
      environments: [...original.environments, original.environments[0]],
    })
    await writeFile(file, duplicate)
    await assert.rejects(registerCheckout(dir, branch('other', 'bbbbbbbbbbbbbbbb')), /Duplicate/)
    assert.equal(await readFile(file, 'utf8'), duplicate)
    await writeFile(file, 'null')
    await assert.rejects(initializePrimary(dir, main), /preserve/)
    assert.equal(await readFile(file, 'utf8'), 'null')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a new checkout at a registered path cannot inherit its old registration', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main, branch } = fixtures(dir)
  const secondary = branch('other', 'bbbbbbbbbbbbbbbb')
  await mkdir(main.root)
  await mkdir(secondary.root)
  try {
    await initializePrimary(dir, main)
    await registerCheckout(dir, secondary)
    await rm(secondary.root, { recursive: true })
    await mkdir(secondary.root)
    await assert.rejects(registerCheckout(dir, secondary), /claim is missing/)
    await createCheckoutClaim(secondary.root, secondary.worktreeId)
    await assert.rejects(registerCheckout(dir, secondary), /claim does not match/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('run reservations serialize and reject stale owners and occupied ports', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main } = fixtures(dir)
  await mkdir(main.root)
  const occupied = createServer()
  const available = createServer()
  try {
    await initializePrimary(dir, main)
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve))
    await new Promise<void>((resolve) => available.listen(0, '127.0.0.1', resolve))
    const occupiedPort = (occupied.address() as { port: number }).port
    const availablePort = (available.address() as { port: number }).port
    await new Promise<void>((resolve) => available.close(() => resolve()))
    const results = await Promise.allSettled([
      reserveRun(dir, main, { ports: [occupiedPort, availablePort] }),
      reserveRun(dir, main, { ports: [occupiedPort, availablePort] }),
    ])
    const successes = results.filter((result) => result.status === 'fulfilled')
    assert.equal(successes.length, 1)
    const run = (successes[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveRun>>>)
      .value
    assert.equal(run.port, availablePort)
    assert.equal((await verifyStartingRun(dir, main, run.instanceId, run.port)).role, 'primary')
    await assert.rejects(
      verifyStartingRun(dir, main, run.instanceId, occupiedPort),
      /does not match/,
    )
    await assert.rejects(
      markRunReady(dir, main, 'wrong-instance', process.pid, new Date().toISOString()),
      /no longer belongs/,
    )
    const exited = spawnSync(process.execPath, ['-e', ''])
    assert.equal(exited.status, 0)
    assert.equal(
      (await markRunReady(dir, main, run.instanceId, exited.pid, new Date().toISOString())).phase,
      'running',
    )
    await new Promise<void>((resolve) => available.listen(availablePort, '127.0.0.1', resolve))
    await assert.rejects(releaseRun(dir, main, run.instanceId), /still listening/)
    await new Promise<void>((resolve) => available.close(() => resolve()))
    await releaseRun(dir, main, run.instanceId)
    await assert.rejects(releaseRun(dir, main, run.instanceId), /no longer belongs/)
  } finally {
    if (occupied.listening) await new Promise<void>((resolve) => occupied.close(() => resolve()))
    if (available.listening) await new Promise<void>((resolve) => available.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('expired startup cannot overwrite its replacement while an old listener remains', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main } = fixtures(dir)
  await mkdir(main.root)
  const oldListener = createServer()
  const probe = createServer()
  try {
    await initializePrimary(dir, main)
    await new Promise<void>((resolve) => oldListener.listen(0, '127.0.0.1', resolve))
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const oldPort = (oldListener.address() as { port: number }).port
    const nextPort = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => oldListener.close(() => resolve()))
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    const first = await reserveRun(dir, main, { ports: [oldPort, nextPort], timeoutMs: 1 })
    await new Promise<void>((resolve) => oldListener.listen(oldPort, '127.0.0.1', resolve))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const second = await reserveRun(dir, main, { ports: [oldPort, nextPort] })
    assert.equal(second.port, nextPort)
    assert.deepEqual(second.retiredPorts, [oldPort])
    await assert.rejects(
      markRunReady(dir, main, first.instanceId, process.pid, new Date().toISOString()),
      /no longer belongs/,
    )
    await assert.rejects(releaseRun(dir, main, first.instanceId), /no longer belongs/)
    const exited = spawnSync(process.execPath, ['-e', ''])
    assert.equal(exited.status, 0)
    await markRunReady(dir, main, second.instanceId, exited.pid, new Date().toISOString())
    await assert.rejects(releaseRun(dir, main, second.instanceId), /previous Hub port/)
    await new Promise<void>((resolve) => oldListener.close(() => resolve()))
    await releaseRun(dir, main, second.instanceId)
  } finally {
    if (oldListener.listening)
      await new Promise<void>((resolve) => oldListener.close(() => resolve()))
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('run record is retained while its recorded process is alive even with a free port', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-registry-')))
  const { main } = fixtures(dir)
  await mkdir(main.root)
  const probe = createServer()
  try {
    await initializePrimary(dir, main)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    const run = await reserveRun(dir, main, { ports: [port] })
    await markRunReady(dir, main, run.instanceId, process.pid, new Date().toISOString())
    await assert.rejects(releaseRun(dir, main, run.instanceId), /process may still be alive/)
    const registry = JSON.parse(await readFile(path.join(dir, 'registry.json'), 'utf8'))
    assert.equal(registry.runs[main.worktreeId].instanceId, run.instanceId)
  } finally {
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})
