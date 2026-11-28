import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  createSpawnEnvironment,
  localEnvironmentPaths,
  prepareLocalEnvironment,
  resolveLocalEnvironment,
} from './local-environment.ts'
import { serviceEnvironmentRoutes } from './service-environment-routes.ts'
import {
  readServiceLocalEnvironment,
  ServiceEnvironmentStore,
  serviceEnvironmentPath,
} from './service-environment.ts'
import { SERVICE_DEFINITIONS } from './services.ts'

async function fixture(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), 'hub-local-config-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const phoenix = structuredClone(SERVICE_DEFINITIONS.find((item) => item.id === 'phoenix')!)
  const assets = structuredClone(SERVICE_DEFINITIONS.find((item) => item.id === 'assets-hub')!)
  const store = new ServiceEnvironmentStore([phoenix, assets], root)
  return { root, phoenix, assets, store }
}

test('read-only configuration shows defaults without initializing state or files', async (t) => {
  const { root, store } = await fixture(t)
  const result = await store.get('phoenix')
  assert.equal(result.appliesOn, 'next-start')
  assert.match(result.filePath, /config\/phoenix\.env$/)
  assert.deepEqual(
    result.entries.find((item) => item.key === 'DB_NAME'),
    {
      key: 'DB_NAME',
      value: 'groupher_server_dev',
      configured: true,
      secret: false,
      editable: true,
      source: 'default',
    },
  )
  assert.equal(result.entries.find((item) => item.key === 'DB_PASSWORD')?.value, null)
  assert.equal(result.entries.find((item) => item.key === 'PHX_JWT_SECRET')?.editable, false)
  await assert.rejects(() => stat(localEnvironmentPaths(root).directory), { code: 'ENOENT' })
})

test('save writes private Hub configuration, scoped by service, and does not initialize identity', async (t) => {
  const { root, phoenix, assets, store } = await fixture(t)
  const result = await store.update('phoenix', {
    DB_NAME: 'groupher_local_accept',
    DB_PASSWORD: 'private-value',
  })
  const file = serviceEnvironmentPath(phoenix, root)
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700)
  assert.equal((await stat(path.dirname(path.dirname(file)))).mode & 0o777, 0o700)
  assert.doesNotMatch(JSON.stringify(result), /private-value/)
  assert.equal(result.entries.find((item) => item.key === 'DB_PASSWORD')?.configured, true)
  assert.deepEqual(await readServiceLocalEnvironment(assets, root), {})
  await assert.rejects(() => stat(localEnvironmentPaths(root).state), { code: 'ENOENT' })
  const recreated = new ServiceEnvironmentStore([phoenix], root)
  assert.equal(
    (await recreated.get('phoenix')).entries.find((item) => item.key === 'DB_NAME')?.value,
    'groupher_local_accept',
  )
})

test('saved changes feed the real spawn resolver; shell values and application dotenv cannot override them', async (t) => {
  const { root, phoenix, store } = await fixture(t)
  await mkdir(path.join(root, 'backend/api'), { recursive: true })
  await writeFile(
    path.join(root, 'backend/api/.env.local'),
    'DB_NAME=legacy_db\nDB_PASSWORD=legacy_password\n',
  )
  await store.update('phoenix', {
    DB_NAME: 'groupher_config_test',
    MIX_BUILD_PATH: '/tmp/owned-build',
  })
  const state = await prepareLocalEnvironment(root, {})
  const resolved = resolveLocalEnvironment('phoenix', state, phoenix)
  const overrides = await readServiceLocalEnvironment(phoenix, root)
  const environment = createSpawnEnvironment(
    phoenix,
    {
      DB_NAME: 'ambient_db',
      MIX_BUILD_PATH: '/wrong',
      OAUTH_GITHUB_CLIENT_SECRET: 'ambient_oauth',
      PATH: '/usr/bin',
    },
    { env: { ...resolved.env, ...overrides } },
  )
  assert.equal(environment.DB_NAME, 'groupher_config_test')
  assert.equal(environment.MIX_BUILD_PATH, '/tmp/owned-build')
  assert.equal(environment.OAUTH_GITHUB_CLIENT_SECRET, undefined)
  assert.equal(environment.PATH, '/usr/bin')
  assert.equal(environment.PHX_JWT_SECRET, state.secrets['phoenix:jwt-secret'])
  const snapshot = await store.get('phoenix')
  assert.equal(snapshot.entries.find((item) => item.key === 'DB_NAME')?.source, 'local')
  assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(state.secrets['phoenix:jwt-secret']))
})

test('partial updates retain secrets, resets remove overrides, and concurrent patches preserve different keys', async (t) => {
  const { phoenix, root, store } = await fixture(t)
  await store.update('phoenix', { DB_PASSWORD: 'keep-secret' })
  await Promise.all([
    store.update('phoenix', { DB_NAME: 'groupher_patch_test' }),
    store.update('phoenix', { DB_POOL_SIZE: '12' }),
  ])
  assert.deepEqual(await readServiceLocalEnvironment(phoenix, root), {
    DB_PASSWORD: 'keep-secret',
    DB_NAME: 'groupher_patch_test',
    DB_POOL_SIZE: '12',
  })
  const result = await store.update('phoenix', { DB_NAME: null, DB_POOL_SIZE: null })
  assert.equal(result.entries.find((item) => item.key === 'DB_NAME')?.value, 'groupher_server_dev')
  assert.equal((await readServiceLocalEnvironment(phoenix, root)).DB_PASSWORD, 'keep-secret')
})

test('managed identity, cross-service settings and malformed values fail without changing the file', async (t) => {
  const { root, phoenix, store } = await fixture(t)
  await store.update('phoenix', { DB_NAME: 'groupher_unchanged' })
  const file = serviceEnvironmentPath(phoenix, root)
  const original = await readFile(file, 'utf8')
  for (const changes of [
    { PHX_JWT_SECRET: 'override' },
    { SERVICE_AUTH_CLIENT_SECRET: null },
    { DASH_DEFAULT_COMMUNITY: 'home' },
    { DB_PORT: 'bad' },
    { DB_NAME: 'first\nSECOND=value' },
    { DB_NAME: 2 },
    { DB_NAME: undefined },
  ]) {
    await assert.rejects(() => store.update('phoenix', changes))
    assert.equal(await readFile(file, 'utf8'), original)
  }
  await assert.rejects(() => store.update('../phoenix', { DB_NAME: 'bad' }))
  await assert.rejects(() => store.update('phoenix', []))
})

test('external credentials come only from central files and are always redacted', async (t) => {
  const { root, assets, store } = await fixture(t)
  assets.config = { kind: 'env-files', root, environment: 'development' }
  await writeFile(path.join(root, '.env'), 'ASSETS_R2_SECRET_ACCESS_KEY=legacy-secret\n')
  assert.deepEqual(await readServiceLocalEnvironment(assets, root), {})
  const result = await store.update('assets-hub', {
    ASSETS_R2_BUCKET: 'test-bucket',
    ASSETS_R2_SECRET_ACCESS_KEY: 'central-secret',
  })
  assert.doesNotMatch(JSON.stringify(result), /central-secret|legacy-secret/)
  assert.equal(
    (await readServiceLocalEnvironment(assets, root)).ASSETS_R2_SECRET_ACCESS_KEY,
    'central-secret',
  )
})

test('dotenv storage preserves quotes, backslashes, hashes and whitespace without JSON escaping', async (t) => {
  const { root, phoenix, store } = await fixture(t)
  for (const value of [
    'quoted"secret\\literal#tail',
    "single'quote",
    'both\'and"',
    ' padded secret ',
    'literal\\n',
  ]) {
    await store.update('phoenix', { DB_PASSWORD: value })
    assert.equal((await readServiceLocalEnvironment(phoenix, root)).DB_PASSWORD, value)
  }
})

test('invalid on-disk managed overrides and symlinks are rejected by the runtime reader', async (t) => {
  const { root, phoenix, store } = await fixture(t)
  await store.update('phoenix', { DB_NAME: 'groupher_config_test' })
  const file = serviceEnvironmentPath(phoenix, root)
  await writeFile(file, 'SERVICE_AUTH_CLIENT_SECRET=forbidden\n')
  await assert.rejects(() => readServiceLocalEnvironment(phoenix, root), /not an editable/)
  await rm(file)
  const outside = path.join(root, 'other.env')
  await writeFile(outside, 'DB_NAME=not-owned\n')
  await symlink(outside, file)
  await assert.rejects(() => store.get('phoenix'), /Invalid Hub/)
})

test('HTTP configuration endpoint persists patches, redacts secrets, and rejects invalid requests', async (t) => {
  const { root, phoenix, store } = await fixture(t)
  const app = serviceEnvironmentRoutes(store)
  const response = await app.request('/phoenix/environment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changes: { DB_NAME: 'groupher_http_test', DB_PASSWORD: 'http-private-value' },
    }),
  })
  assert.equal(response.status, 200)
  assert.doesNotMatch(await response.text(), /http-private-value/)
  assert.equal((await readServiceLocalEnvironment(phoenix, root)).DB_NAME, 'groupher_http_test')
  const invalid = await app.request('/phoenix/environment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid-secret-json',
  })
  assert.equal(invalid.status, 400)
  assert.doesNotMatch(await invalid.text(), /invalid-secret-json/)
  const forbidden = await app.request('/phoenix/environment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: { SERVICE_AUTH_CLIENT_SECRET: 'forbidden' } }),
  })
  assert.equal(forbidden.status, 400)
  assert.equal((await app.request('/unknown/environment')).status, 404)
  const oversized = await app.request('/phoenix/environment', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(65537),
  })
  assert.equal(oversized.status, 413)
})
