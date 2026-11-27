import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  initializePrimary,
  markRunReady,
  registerCheckout,
  reserveRun,
} from './environment-registry.ts'
import { resolveHubRoute } from './hub-route.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('registered checkout routes only to its own instance and rejects conflicting overrides', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-route-')))
  const primaryRoot = path.join(base, 'primary')
  const secondaryRoot = path.join(base, 'secondary')
  const registry = path.join(base, 'registry')
  const probe = createServer()
  try {
    await mkdir(primaryRoot)
    await mkdir(secondaryRoot)
    execFileSync('git', ['init', '-q', primaryRoot])
    execFileSync('git', ['init', '-q', secondaryRoot])
    const primary = await resolveCheckout(primaryRoot)
    const secondary = await resolveCheckout(secondaryRoot)
    await initializePrimary(registry, primary)
    await registerCheckout(registry, secondary)
    await assert.rejects(resolveHubRoute(secondaryRoot, registry), /No Hub is running/)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    const run = await reserveRun(registry, secondary, { ports: [port] })
    await markRunReady(registry, secondary, run.instanceId, process.pid, new Date().toISOString())
    const route = await resolveHubRoute(secondaryRoot, registry)
    assert.deepEqual(route, {
      origin: `http://127.0.0.1:${port}`,
      instanceId: run.instanceId,
      mode: 'control-only',
      role: 'secondary',
    })
    await assert.rejects(
      resolveHubRoute(secondaryRoot, registry, 'http://127.0.0.1:4310'),
      /conflicts/,
    )
    assert.equal((await resolveHubRoute(primaryRoot, registry)).mode, 'legacy')
  } finally {
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(base, { recursive: true, force: true })
  }
})
