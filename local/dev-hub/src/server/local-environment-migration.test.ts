import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { migrateLocalEnvironment } from '../../scripts/migrate-local-environment.ts'
import { localEnvironmentPaths } from './local-environment.ts'
import { SERVICE_DEFINITIONS } from './services.ts'

const quote = (value: string) => `'${value.replaceAll("'", "\\'")}'`
const hash = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`

const makeLegacyFixture = async (root: string) => {
  const serviceDefinitions = SERVICE_DEFINITIONS.filter(
    (definition) => definition.localEnvironment?.serviceAuth,
  )
  const oldIds = new Set(['auth', 'assets-hub', 'phoenix', 'dash'])
  const serviceSecrets = Object.fromEntries(
    [...oldIds].map((serviceId) => [serviceId, randomBytes(24).toString('base64url')]),
  )
  const registrations = serviceDefinitions
    .filter((definition) => oldIds.has(definition.id))
    .map((definition) => {
      const requirement = definition.localEnvironment!.serviceAuth!
      return {
        allowedAudiences: requirement.allowedAudiences,
        allowedScopes: requirement.allowedScopes,
        clientId: requirement.clientId,
        clientRef: requirement.clientRef,
        credentialHashes: [hash(serviceSecrets[definition.id])],
        serviceName: requirement.serviceName,
        status: 'active',
      }
    })
  const authDefinition = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')!
  const authDirectory = path.join(root, 'backend/auth')
  await mkdir(authDirectory, { recursive: true })
  const localAuth = {
    SERVICE_AUTH_SIGNING_JWK: JSON.stringify({
      kty: 'RSA',
      n: 'fixture-modulus',
      d: 'fixture-private',
    }),
    SERVICE_AUTH_RESOURCES_JSON: JSON.stringify(authDefinition.localEnvironment!.authResources),
    SERVICE_AUTH_CLIENTS_JSON: JSON.stringify(
      registrations.filter((client) => client.serviceName !== 'dash'),
    ),
    SERVICE_AUTH_CLIENTS_JSON_EXTRA: JSON.stringify(
      registrations.filter((client) => client.serviceName === 'dash'),
    ),
    NEXTAUTH_SECRET: 'existing-session-secret',
    SERVICE_AUTH_CLIENT_ID: 'auth-development',
    SERVICE_AUTH_CLIENT_SECRET: serviceSecrets.auth,
  }
  await writeEnv(path.join(authDirectory, '.env.local'), localAuth)

  const dashDirectory = path.join(root, 'frontend/dash')
  await mkdir(dashDirectory, { recursive: true })
  await writeEnv(path.join(dashDirectory, '.env.local'), {
    SERVICE_AUTH_CLIENT_ID: 'dash-development',
    SERVICE_AUTH_CLIENT_SECRET: serviceSecrets.dash,
  })
  const apiDirectory = path.join(root, 'backend/api')
  await mkdir(apiDirectory, { recursive: true })
  await writeEnv(path.join(apiDirectory, '.env.local'), {
    SERVICE_AUTH_CLIENT_ID: 'phoenix-development',
    SERVICE_AUTH_CLIENT_SECRET: serviceSecrets.phoenix,
    PHX_JWT_SECRET: 'existing-phoenix-jwt-secret',
  })
  const assetsDirectory = path.join(root, 'backend/assets-hub')
  await mkdir(assetsDirectory, { recursive: true })
  await writeEnv(path.join(assetsDirectory, '.env'), {
    SERVICE_AUTH_CLIENT_ID: 'assets-hub-development',
    SERVICE_AUTH_CLIENT_SECRET: serviceSecrets['assets-hub'],
    ASSETS_HUB_CAPABILITY_SECRET: 'existing-assets-capability-secret',
  })
  return { authFile: path.join(authDirectory, '.env.local'), serviceSecrets }
}

const writeEnv = async (file: string, values: Record<string, string>) => {
  await writeFile(
    file,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${quote(value)}`)
      .join('\n')}\n`,
    {
      mode: 0o600,
    },
  )
  await chmod(file, 0o600)
}

test('migration check is read-only and reports an empty environment as unnecessary', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-migration-empty-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  assert.equal((await migrateLocalEnvironment(root, 'check')).status, 'no-migration-needed')
  await assert.rejects(() => stat(localEnvironmentPaths(root).directory), { code: 'ENOENT' })
})

test('migration check validates legacy credentials without writing and apply backs up then commits once', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-migration-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const { authFile, serviceSecrets } = await makeLegacyFixture(root)
  const originalAuth = await readFile(authFile, 'utf8')

  const check = await migrateLocalEnvironment(root, 'check')
  assert.equal(check.status, 'ready')
  assert.deepEqual(check.conflicts, [])
  await assert.rejects(() => stat(localEnvironmentPaths(root).directory), { code: 'ENOENT' })

  const applied = await migrateLocalEnvironment(root, 'apply')
  assert.equal(applied.status, 'applied')
  assert.equal(await readFile(authFile, 'utf8'), originalAuth)

  const paths = localEnvironmentPaths(root)
  const state = JSON.parse(await readFile(paths.state, 'utf8'))
  assert.equal(state.serviceCredentials.dash.clientId, 'dash-development')
  assert.equal(state.serviceCredentials.dash.clientRef, 'dev-hub-local-dash')
  assert.equal(state.serviceCredentials.dash.secret, serviceSecrets.dash)
  assert.equal(state.serviceCredentials['assets-hub'].secret, serviceSecrets['assets-hub'])
  assert.equal((await stat(paths.state)).mode & 0o777, 0o600)
  const backup = path.join(paths.directory, 'backup')
  assert.equal((await stat(backup)).mode & 0o777, 0o700)
  assert.equal((await stat(path.join(backup, 'backend/auth/.env.local'))).mode & 0o777, 0o600)
  assert.equal((await migrateLocalEnvironment(root, 'apply')).status, 'no-op')
})

test('migration conflict leaves old files and local environment state untouched', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-migration-conflict-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const { authFile } = await makeLegacyFixture(root)
  const dashFile = path.join(root, 'frontend/dash/.env.local')
  await writeEnv(dashFile, {
    SERVICE_AUTH_CLIENT_ID: 'dash-development',
    SERVICE_AUTH_CLIENT_SECRET: 'conflicting-secret',
  })
  const oldAuth = await readFile(authFile, 'utf8')
  const oldDash = await readFile(dashFile, 'utf8')

  const result = await migrateLocalEnvironment(root, 'apply')
  assert.equal(result.status, 'conflict')
  assert.match(result.conflicts.join('\n'), /Cannot verify the existing plaintext credential/)
  assert.equal(await readFile(authFile, 'utf8'), oldAuth)
  assert.equal(await readFile(dashFile, 'utf8'), oldDash)
  await assert.rejects(() => stat(localEnvironmentPaths(root).state), { code: 'ENOENT' })
})

test('a failed migration write leaves old state absent and old inputs unchanged', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-migration-fault-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const { authFile } = await makeLegacyFixture(root)
  const originalAuth = await readFile(authFile, 'utf8')

  await assert.rejects(
    () =>
      migrateLocalEnvironment(root, 'apply', {
        beforeStateWrite: async () => {
          throw new Error('injected state write failure')
        },
      }),
    /injected state write failure/,
  )
  assert.equal(await readFile(authFile, 'utf8'), originalAuth)
  await assert.rejects(() => stat(localEnvironmentPaths(root).state), { code: 'ENOENT' })
  assert.equal(
    (await stat(path.join(localEnvironmentPaths(root).directory, 'backup'))).mode & 0o777,
    0o700,
  )
})

test('Import registry takes precedence over base clients and rejects duplicate overlay entries', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-environment-import-overlay-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const { authFile, serviceSecrets } = await makeLegacyFixture(root)
  const original = await readFile(authFile, 'utf8')
  const requirement = SERVICE_DEFINITIONS.find((entry) => entry.id === 'dash')!.localEnvironment!
    .serviceAuth!
  const registration = {
    ...requirement,
    credentialHashes: [hash(serviceSecrets.dash)],
    status: 'active',
  }
  await writeFile(
    authFile,
    original + `SERVICE_AUTH_CLIENTS_JSON_IMPORT=${quote(JSON.stringify([registration]))}\n`,
  )
  const result = await migrateLocalEnvironment(root, 'check')
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.conflicts, [])

  await writeFile(
    authFile,
    original +
      `SERVICE_AUTH_CLIENTS_JSON_IMPORT=${quote(JSON.stringify([registration, registration]))}\n`,
  )
  const duplicate = await migrateLocalEnvironment(root, 'check')
  assert.equal(duplicate.status, 'conflict')
  assert.match(duplicate.conflicts.join('\n'), /duplicate Auth registration/)
})
