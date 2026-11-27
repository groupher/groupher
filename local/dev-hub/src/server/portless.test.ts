import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildPortlessAliases, PortlessManager, withPortlessLock } from './portless.ts'
import { SERVICE_DEFINITIONS } from './services.ts'

const definitions = SERVICE_DEFINITIONS.filter(({ id }) => id === 'dash')
const lockDirectory = mkdtempSync(path.join(tmpdir(), 'groupher-portless-test-'))
test.after(() => rmSync(lockDirectory, { recursive: true, force: true }))
const canonicalRoute = {
  hostname: 'dash.groupher.localhost',
  port: 3005,
  pid: 0,
  url: 'https://dash.groupher.localhost',
}

function fixture(
  options: {
    running?: boolean
    owned?: boolean
    badTLS?: boolean
    badPort?: boolean
    startFails?: boolean
    untrusted?: boolean
    verifyAliases?: boolean
    badAlias?: boolean
  } = {},
) {
  let running = options.running ?? false
  let routes = [{ ...canonicalRoute, port: 3103, ...(options.owned ? { pid: 123 } : {}) }]
  const calls: string[][] = []
  const manager = new PortlessManager(
    definitions,
    {
      probe: async (ca) => running && (!ca || !options.badTLS),
      readCA: async () => 'test-ca',
      probeAlias: async () => !options.badAlias,
      run: async (args) => {
        calls.push(args)
        if (args[0] === 'proxy') {
          if (options.startFails) throw new Error('sudo requires a terminal')
          running = !options.badPort
        }
        if (args[0] === 'doctor')
          return JSON.stringify({
            stateDir: '/test',
            proxyTarget: 'https://127.0.0.1',
            mode: 'HTTPS, .localhost',
            findings: options.untrusted ? [{ status: 'warn', hint: 'Run: portless trust' }] : [],
          })
        if (args[0] === 'list') return JSON.stringify({ routes })
        if (args[0] === 'alias') routes = args[1] === '--remove' ? [] : [{ ...canonicalRoute }]
        return ''
      },
    },
    lockDirectory,
    options.verifyAliases,
  )
  return {
    manager,
    calls,
    stopProxy: () => {
      running = false
    },
  }
}

test('isolated environments require each alias to pass DNS and TLS checks', async () => {
  await fixture({ running: true, verifyAliases: true }).manager.ensure()
  await assert.rejects(
    fixture({ running: true, verifyAliases: true, badAlias: true }).manager.ensure(),
    /DNS or TLS verification failed/,
  )
})

test('serializes route changes across independent managers', async () => {
  let active = 0
  let peak = 0
  await Promise.all(
    Array.from({ length: 3 }, () =>
      withPortlessLock(lockDirectory, async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 30))
        active--
      }),
    ),
  )
  assert.equal(peak, 1)
})

test('aliases use service definitions and include nested endpoints', () => {
  const aliases = buildPortlessAliases(SERVICE_DEFINITIONS)
  assert.equal(
    aliases.find(({ hostname }) => hostname === 'landing.groupher.localhost')?.port,
    3002,
  )
  assert.equal(aliases.find(({ hostname }) => hostname === 'dash.groupher.localhost')?.port, 3005)
  assert.equal(aliases.find(({ hostname }) => hostname === 'assets.groupher.localhost')?.port, 8002)
  assert.equal(
    aliases.find(({ hostname }) => hostname === 'assets-worker.groupher.localhost')?.port,
    8787,
  )
  assert.equal(
    aliases.some(({ hostname }) => hostname === 'dashboard.groupher.localhost'),
    false,
  )
})

test('cold start ensures HTTPS without recurring system setup, --force or startup services', async () => {
  const { manager, calls } = fixture()
  await manager.ensure()
  assert.deepEqual(calls[0], [
    'proxy',
    'start',
    '--https',
    '--port',
    '443',
    '--tld',
    'localhost',
    ...(process.platform === 'darwin' ? ['--unprivileged'] : []),
  ])
  assert.ok(
    calls.some((args) => args.join(' ') === 'alias dash.groupher.localhost 3005 --tld localhost'),
  )
  assert.ok(calls.every((args) => !args.includes('--force') && args[0] !== 'service'))
  assert.ok(calls.every(([command]) => command !== 'trust' && command !== 'hosts'))
})

test('concurrent ensures share preparation; later calls recover a proxy that exited', async () => {
  const { manager, calls, stopProxy } = fixture({ running: true })
  await Promise.all([manager.ensure(), manager.ensure(), manager.ensure()])
  assert.equal(calls.filter(([command]) => command === 'doctor').length, 1)
  assert.equal(calls.filter(([command]) => command === 'proxy').length, 0)
  stopProxy()
  await manager.ensure()
  assert.equal(calls.filter(([command]) => command === 'proxy').length, 1)
})

test('an alias owned by another process is rejected without replacing or stopping it', async () => {
  const { manager, calls } = fixture({ running: true, owned: true })
  await assert.rejects(manager.ensure(), /owned by PID 123/)
  assert.equal(
    calls.some(([command]) => command === 'alias'),
    false,
  )
})

test('removes only aliases still matching the reserved ports', async () => {
  const { manager, calls } = fixture({ running: true })
  await manager.ensure()
  await manager.removeOwnedAliases()
  assert.ok(
    calls.some(
      (args) => args.join(' ') === 'alias --remove dash.groupher.localhost --tld localhost',
    ),
  )
  const changed = fixture({ running: true, owned: true })
  await assert.rejects(changed.manager.removeOwnedAliases(), /changed ownership/)
  assert.ok(changed.calls.every((args) => args[0] !== 'alias'))
})

test('ordinary startup reports missing CA trust without attempting sudo setup', async () => {
  const { manager, calls } = fixture({ running: true, untrusted: true })
  await assert.rejects(manager.ensure(), /local CA is not trusted/)
  assert.ok(calls.every(([command]) => command !== 'trust' && command !== 'hosts'))
})

test('explicit setup owns idempotent CA trust and hosts initialization', async () => {
  const { manager, calls } = fixture({ running: true })
  await manager.ensure(true)
  assert.ok(calls.some(([command]) => command === 'trust'))
  assert.deepEqual(calls.at(-1), ['hosts', 'sync'])
})

test('failed elevation blocks startup and can be retried without falling back to another port', async () => {
  const { manager, calls } = fixture({ startFails: true })
  await assert.rejects(manager.ensure(), /sudo requires a terminal/)
  await assert.rejects(manager.ensure(), /Do not change ports/)
  assert.equal(calls.length, 2)
})

test('successful CLI exit cannot conceal a proxy on the wrong port', async () => {
  const { manager, calls } = fixture({ badPort: true })
  await assert.rejects(manager.ensure(), /not responding on port 443/)
  assert.equal(
    calls.some(([command]) => command === 'alias'),
    false,
  )
})

test('a live proxy with the wrong certificate cannot pass preparation', async () => {
  const { manager, calls } = fixture({ running: true, badTLS: true })
  await assert.rejects(manager.ensure(), /certificate check failed/)
  assert.equal(
    calls.some(([command]) => command === 'alias'),
    false,
  )
})
