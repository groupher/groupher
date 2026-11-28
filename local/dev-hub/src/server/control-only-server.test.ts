import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { initializePrimary, markRunReady, releaseRun, reserveRun } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('a reserved control-only child serves its identity and shuts down without touching product services', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-control-process-')))
  const root = path.join(base, 'checkout')
  const registry = path.join(base, 'registry')
  const script = path.join(base, 'child.mjs')
  const probe = createServer()
  let child: ChildProcess | undefined
  try {
    await mkdir(root)
    execFileSync('git', ['init', '-q', root])
    const identity = await resolveCheckout(root)
    await initializePrimary(registry, identity)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    const run = await reserveRun(registry, identity, { ports: [port] })
    const moduleUrl = new URL('./control-only-server.ts', import.meta.url).href
    await writeFile(
      script,
      `import { startControlOnly } from ${JSON.stringify(moduleUrl)};\nawait startControlOnly(process.argv[2], process.argv[3], process.argv[4], Number(process.argv[5]));\n`,
    )
    child = spawn(
      process.execPath,
      ['--import', 'tsx', script, root, registry, run.instanceId, String(port)],
      { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    const origin = `http://127.0.0.1:${port}`
    let response: Response | undefined
    const until = Date.now() + 10_000
    while (!response && Date.now() < until && child.exitCode === null) {
      try {
        const attempt = await fetch(`${origin}/api/identity`, { signal: AbortSignal.timeout(500) })
        if (attempt.ok) response = attempt
        else await new Promise((resolve) => setTimeout(resolve, 25))
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
    assert.ok(response, `control-only child did not start: ${stderr}`)
    assert.equal(((await response.json()) as { instanceId: string }).instanceId, run.instanceId)
    assert.ok(child.pid)
    await markRunReady(registry, identity, run.instanceId, child.pid, new Date().toISOString())
    assert.equal((await fetch(`${origin}/api/services/dash/start`, { method: 'POST' })).status, 403)
    assert.equal(
      (
        await fetch(`${origin}/api/shutdown`, {
          method: 'POST',
          headers: { 'x-groupher-instance-id': 'old' },
        })
      ).status,
      409,
    )
    const exited = once(child, 'exit')
    assert.equal(
      (
        await fetch(`${origin}/api/shutdown`, {
          method: 'POST',
          headers: { 'x-groupher-instance-id': run.instanceId },
        })
      ).status,
      200,
    )
    await exited
    await releaseRun(registry, identity, run.instanceId)
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(base, { recursive: true, force: true })
  }
})
