import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { downControlOnly, upControlOnly, verifyRunningHub } from './control-lifecycle.ts'
import { initializePrimary, readRegisteredRun, registerCheckout } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

test('up reuses a verified child and down releases only that child', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-control-life-')))
  const root = path.join(base, 'checkout')
  const registry = path.join(base, 'registry')
  const script = path.join(base, 'child.mjs')
  const probe = createServer()
  let started = false
  let identity: Awaited<ReturnType<typeof resolveCheckout>> | undefined
  try {
    await mkdir(root)
    execFileSync('git', ['init', '-q', root])
    identity = await resolveCheckout(root)
    await initializePrimary(registry, identity)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    const moduleUrl = new URL('./control-only-server.ts', import.meta.url).href
    await writeFile(
      script,
      `import { startControlOnly } from ${JSON.stringify(moduleUrl)};\nawait startControlOnly(${JSON.stringify(root)}, ${JSON.stringify(registry)}, process.env.DEV_HUB_INSTANCE_ID, Number(process.env.DEV_HUB_PORT));\n`,
    )
    const options = {
      entryPath: script,
      cwd: process.cwd(),
      logDirectory: path.join(base, 'logs'),
      ports: [port],
    }
    const first = await upControlOnly(identity, registry, options)
    started = true
    const second = await upControlOnly(identity, registry, options)
    assert.equal(second.instanceId, first.instanceId)
    assert.equal((await verifyRunningHub(identity, registry)).instanceId, first.instanceId)
    await assert.rejects(
      upControlOnly(identity, registry, { ...options, reuseExisting: false }),
      /already registered/,
    )
    assert.equal((await readRegisteredRun(registry, identity))?.phase, 'running')
    await downControlOnly(identity, registry)
    started = false
    assert.equal(await readRegisteredRun(registry, identity), null)
    await assert.rejects(verifyRunningHub(identity, registry), /No running Hub/)
  } finally {
    if (started && identity) await downControlOnly(identity, registry)
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(base, { recursive: true, force: true })
  }
})

test('primary full-mode identity is retained across up and down', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-full-life-')))
  const root = path.join(base, 'checkout')
  const registry = path.join(base, 'registry')
  const script = path.join(base, 'child.mjs')
  const probe = createServer()
  let identity: Awaited<ReturnType<typeof resolveCheckout>> | undefined
  let started = false
  try {
    await mkdir(root)
    execFileSync('git', ['init', '-q', root])
    identity = await resolveCheckout(root)
    await initializePrimary(registry, identity)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    await writeFile(
      script,
      `import http from 'node:http'; const id=process.env.DEV_HUB_INSTANCE_ID; const port=Number(process.env.DEV_HUB_PORT); const server=http.createServer((req,res)=>{ if(req.url==='/api/identity'){res.setHeader('content-type','application/json');res.end(JSON.stringify({repoRoot:${JSON.stringify(root)},apiOrigin:'http://127.0.0.1:'+port,instanceId:id,role:'primary',mode:'full',apiVersion:1}));}else if(req.url==='/api/shutdown'&&req.headers['x-groupher-instance-id']===id){res.end('{}');server.close();}else{res.statusCode=403;res.end();}});server.listen(port,'127.0.0.1');`,
    )
    const options = {
      entryPath: script,
      cwd: process.cwd(),
      logDirectory: path.join(base, 'logs'),
      ports: [port],
      mode: 'full' as const,
    }
    const first = await upControlOnly(identity, registry, options)
    started = true
    assert.equal(first.mode, 'full')
    assert.equal((await readRegisteredRun(registry, identity))?.mode, 'full')
    assert.equal((await upControlOnly(identity, registry, options)).instanceId, first.instanceId)
    await downControlOnly(identity, registry)
    started = false
    assert.equal(await readRegisteredRun(registry, identity), null)
  } finally {
    if (started && identity) await downControlOnly(identity, registry)
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(base, { recursive: true, force: true })
  }
})

test('secondary full-mode startup retains independent reserved service ports', async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'hub-secondary-life-')))
  const primary = path.join(base, 'primary')
  const root = path.join(base, 'secondary')
  const registry = path.join(base, 'registry')
  const script = path.join(base, 'child.mjs')
  const probe = createServer()
  let identity: Awaited<ReturnType<typeof resolveCheckout>> | undefined
  let started = false
  try {
    execFileSync('git', ['init', '-q', primary])
    execFileSync('git', ['init', '-q', root])
    await initializePrimary(registry, await resolveCheckout(primary))
    identity = await resolveCheckout(root)
    await registerCheckout(registry, identity)
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as { port: number }).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    await writeFile(
      script,
      `import http from 'node:http'; const id=process.env.DEV_HUB_INSTANCE_ID; const port=Number(process.env.DEV_HUB_PORT); const server=http.createServer((req,res)=>{ if(req.url==='/api/identity'){res.setHeader('content-type','application/json');res.end(JSON.stringify({repoRoot:${JSON.stringify(root)},apiOrigin:'http://127.0.0.1:'+port,instanceId:id,role:'secondary',mode:'full',apiVersion:1}));}else if(req.url==='/api/shutdown'&&req.headers['x-groupher-instance-id']===id){res.end('{}');server.close();}else{res.statusCode=403;res.end();}});server.listen(port,'127.0.0.1');`,
    )
    const options = {
      entryPath: script,
      cwd: process.cwd(),
      logDirectory: path.join(base, 'logs'),
      ports: [port],
      mode: 'full' as const,
      serviceIds: ['auth', 'phoenix'],
    }
    const first = await upControlOnly(identity, registry, options)
    started = true
    assert.equal(first.role, 'secondary')
    assert.deepEqual(Object.keys((await readRegisteredRun(registry, identity))!.servicePorts!), [
      'auth',
      'phoenix',
    ])
    await assert.rejects(
      downControlOnly(identity, registry, async () => {
        assert.ok(await readRegisteredRun(registry, identity!))
        throw new Error('alias cleanup failed')
      }),
      /alias cleanup failed/,
    )
    assert.ok(await readRegisteredRun(registry, identity))
    await downControlOnly(identity, registry, async () => {})
    started = false
  } finally {
    if (started && identity) await downControlOnly(identity, registry, async () => {})
    if (probe.listening) await new Promise<void>((resolve) => probe.close(() => resolve()))
    await rm(base, { recursive: true, force: true })
  }
})
