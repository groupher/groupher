import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { parseEnv } from 'node:util'

import {
  LocalEnvironmentError,
  assertLocalEnvironmentAllowed,
  assertNoManagedEnvironment,
  createSpawnEnvironment,
  filterParentEnvironment,
  localEnvironmentPaths,
  localWorkerEnvironmentPaths,
  localEnvironmentStateMode,
  MANAGED_ENV_KEYS,
  prepareLocalEnvironment,
  resolveLocalEnvironment,
  writeLocalWorkerEnvironment,
} from './local-environment.ts'
import { SERVICE_DEFINITIONS, type TServiceDefinition } from './services.ts'

const definition = (root: string): TServiceDefinition => ({
  id: 'fixture',
  name: 'Fixture',
  description: 'Local environment fixture.',
  group: 'backend',
  monogram: 'FX',
  cwd: root,
  command: 'node',
  args: ['server.js'],
  env: { FIXTURE_MODE: 'local' },
  localEnvironment: { env: { AUTH_LOCAL_LOGIN_ENABLED: 'true' } },
  metrics: {
    serverCpuPercent: 100,
    serverRssBytes: 1024,
    browserBusyPercent: 50,
    browserHeapBytes: 1024,
  },
})

test('prepare creates one private stable state and separate service identities', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-'))
  t.after(async () => rm(root, { recursive: true, force: true }))

  const [first, concurrent] = await Promise.all([
    prepareLocalEnvironment(root, {}),
    prepareLocalEnvironment(root, {}),
  ])
  const second = await prepareLocalEnvironment(root, {})
  const paths = localEnvironmentPaths(root)

  assert.deepEqual(first, concurrent)
  assert.deepEqual(first, second)
  assert.equal(await localEnvironmentStateMode(paths.state), 0o600)
  assert.equal((await (await import('node:fs/promises')).stat(paths.directory)).mode & 0o777, 0o700)
  assert.notEqual(first.serviceCredentials.auth.secret, first.serviceCredentials.dash.secret)
  assert.notEqual(
    first.serviceCredentials['assets-hub'].secret,
    first.serviceCredentials.phoenix.secret,
  )
  assert.notEqual(
    first.serviceCredentials['assets-read-worker'].secret,
    first.serviceCredentials['assets-hub'].secret,
  )
  assert.equal(first.serviceCredentials.dash.clientId, 'dash-development')
  assert.equal(first.serviceCredentials.dash.clientRef, 'dev-hub-local-dash')
  assert.equal(
    first.serviceCredentials['assets-read-worker'].clientId,
    'assets-read-worker-development',
  )
})

test('preparation uses only the Hub configuration when application dotenv files exist', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-independent-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const appFile = path.join(root, 'frontend/dash/.env.local')
  await mkdir(path.dirname(appFile), { recursive: true })
  const contents = 'SERVICE_AUTH_CLIENT_SECRET=existing-local-secret\n'
  await writeFile(appFile, contents)

  const state = await prepareLocalEnvironment(root, {})
  assert.notEqual(state.serviceCredentials.dash.secret, 'existing-local-secret')
  assert.equal(await readFile(appFile, 'utf8'), contents)
})

test('filters managed parent keys while retaining toolchain environment', () => {
  assert.deepEqual(
    filterParentEnvironment({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      CLOUDFLARE_API_TOKEN: 'ambient-cloudflare-token',
      DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      SERVICE_AUTH_CLIENT_SECRET: 'ambient-secret',
      SERVICE_AUTH_CLIENTS_JSON_IMPORT: 'ambient-import-registry',
      AUTH_LOCAL_LOGIN_ENABLED: 'false',
      NODE_ENV: 'development',
    }),
    { PATH: '/usr/bin', HOME: '/tmp/home', NODE_ENV: 'development' },
  )
})

test('writes Wrangler environment projections privately under the temporary directory', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-worker-environment-'))
  t.after(async () => {
    const { workerRoot } = await import('./storage-paths.ts')
    await rm(workerRoot(root), { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  })
  const values = {
    ENVIRONMENT: 'development',
    REVIEW_BOT_TOKEN: 'local token with spaces',
  }

  const paths = await writeLocalWorkerEnvironment('review-ai', values, root)
  const written = await readFile(paths.envFile, 'utf8')
  const parsed = parseEnv(written)

  assert.deepEqual(parsed, values)
  assert.equal((await (await import('node:fs/promises')).stat(paths.directory)).mode & 0o777, 0o700)
  assert.equal(await localEnvironmentStateMode(paths.envFile), 0o600)
  const { worktreeId } = await import('./storage-paths.ts')
  assert.equal(
    paths.envFile,
    path.join(tmpdir(), 'groupher-dev-hub', worktreeId(root), 'workers', 'review-ai', '.env'),
  )
})

test('one managed-key set covers every service resolved environment', () => {
  for (const service of SERVICE_DEFINITIONS) {
    assert.doesNotThrow(() =>
      assertNoManagedEnvironment(`${service.id} definition.env`, service.env || {}),
    )
    for (const key of Object.keys(service.localEnvironment?.env || {})) {
      assert.equal(MANAGED_ENV_KEYS.has(key), true, `${service.id}.${key}`)
    }
  }
})

test('the removed local Admin opt-in cannot enable a fixed account; fixture keys stay managed', () => {
  const auth = SERVICE_DEFINITIONS.find((service) => service.id === 'auth')!
  const state = {
    formatVersion: 1 as const,
    repoRoot: tmpdir(),
    secrets: {
      'auth:service-signing-jwk': 'test-private-jwk',
      'auth:session-secret': 'test-session-secret',
    },
    serviceCredentials: {},
  }

  const resolved = resolveLocalEnvironment(auth.id, state, auth, {
    DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
  })
  const childEnvironment = createSpawnEnvironment(
    auth,
    { PATH: '/usr/bin', DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED: 'true' },
    resolved,
  )

  assert.equal(resolved.env.AUTH_LOCAL_ADMIN_LOGIN_ENABLED, undefined)
  assert.equal(childEnvironment.AUTH_LOCAL_ADMIN_LOGIN_ENABLED, undefined)
  assert.ok(resolved.env.LOCAL_TEST_ACTORS_SECRET.length >= 32)
  assert.equal(childEnvironment.LOCAL_TEST_ACTORS_SECRET, resolved.env.LOCAL_TEST_ACTORS_SECRET)
  assert.equal(childEnvironment.DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED, undefined)
  assert.equal(
    resolveLocalEnvironment(auth.id, state, auth, {}).env.AUTH_LOCAL_ADMIN_LOGIN_ENABLED,
    undefined,
  )
})

test('resolved managed values are last and definition collisions fail', () => {
  const root = tmpdir()
  const service = definition(root)
  const result = createSpawnEnvironment(
    service,
    {
      PATH: '/usr/bin',
      SERVICE_AUTH_CLIENT_SECRET: 'ambient-secret',
      SERVICE_AUTH_CLIENTS_JSON_IMPORT: 'ambient-import-registry',
      AUTH_LOCAL_LOGIN_ENABLED: 'false',
    },
    { env: { AUTH_LOCAL_LOGIN_ENABLED: 'true' } },
    'http://127.0.0.1:4311',
  )
  assert.equal(result.AUTH_LOCAL_LOGIN_ENABLED, 'true')
  assert.equal(result.PATH, '/usr/bin')
  assert.equal(result.SERVICE_AUTH_CLIENT_SECRET, undefined)
  assert.equal(result.DEV_HUB_URL, 'http://127.0.0.1:4311')

  assert.throws(
    () =>
      createSpawnEnvironment(
        { ...service, env: { ...service.env, SERVICE_AUTH_ISSUER: 'https://bad.example' } },
        {},
        { env: { SERVICE_AUTH_ISSUER: 'https://auth.groupher.localhost' } },
      ),
    (error: unknown) =>
      error instanceof LocalEnvironmentError && /SERVICE_AUTH_ISSUER/.test(error.message),
  )
})

test('production runtime markers reject preparation before state is written', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-production-'))
  t.after(async () => rm(root, { recursive: true, force: true }))

  assert.throws(
    () => assertLocalEnvironmentAllowed({ CLOUDFLARE_ENV: 'production' }),
    LocalEnvironmentError,
  )
  await assert.rejects(
    () => prepareLocalEnvironment(root, { NODE_ENV: 'production' }),
    LocalEnvironmentError,
  )
  await assert.rejects(() => readFile(localEnvironmentPaths(root).state), { code: 'ENOENT' })
})

test('corrupt state and foreign-worktree state are blocking errors', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-invalid-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const paths = localEnvironmentPaths(root)
  await mkdir(paths.directory, { recursive: true })
  await writeFile(paths.state, '{bad json')
  await chmod(paths.state, 0o600)
  await assert.rejects(() => prepareLocalEnvironment(root, {}), /invalid JSON/)

  await writeFile(
    paths.state,
    JSON.stringify({ formatVersion: 1, repoRoot: '/other', secrets: {}, serviceCredentials: {} }),
  )
  await assert.rejects(() => prepareLocalEnvironment(root, {}), /does not match this repository/)
})

test('an occupied lock times out with owner details and is not removed', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-lock-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const paths = localEnvironmentPaths(root)
  await mkdir(paths.directory, { recursive: true })
  await writeFile(paths.lock, JSON.stringify({ pid: process.pid, createdAt: 'now' }), {
    mode: 0o600,
  })

  await assert.rejects(
    () => prepareLocalEnvironment(root, {}, { lockWaitMs: 10 }),
    (error: unknown) =>
      error instanceof LocalEnvironmentError &&
      /Timed out/.test(error.message) &&
      /alive/.test(error.message),
  )
  assert.equal(await readFile(paths.lock, 'utf8').then(Boolean), true)
})
