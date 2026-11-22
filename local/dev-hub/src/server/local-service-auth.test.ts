import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { localEnvironmentPaths } from './local-environment.ts'
import { setupLocalServiceAuth } from './local-service-auth.ts'

test('setup-auth uses shared preparation and leaves legacy app env files unchanged', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupher-setup-auth-'))
  t.after(async () => rm(root, { recursive: true, force: true }))

  const authFile = path.join(root, 'backend/auth/.env.local')
  const dashFile = path.join(root, 'frontend/dash/.env.local')
  await mkdir(path.dirname(authFile), { recursive: true })
  await mkdir(path.dirname(dashFile), { recursive: true })
  const authContent = 'AUTH_GITHUB_ID=oauth-client-id\n'
  const dashContent = 'DASH_DEFAULT_COMMUNITY=home\n'
  await writeFile(authFile, authContent)
  await writeFile(dashFile, dashContent)

  assert.deepEqual(await setupLocalServiceAuth(root, {}), { ready: true })
  const stateBefore = await readFile(localEnvironmentPaths(root).state, 'utf8')
  assert.deepEqual(await setupLocalServiceAuth(root, {}), { ready: true })
  assert.equal(await readFile(localEnvironmentPaths(root).state, 'utf8'), stateBefore)
  assert.equal(await readFile(authFile, 'utf8'), authContent)
  assert.equal(await readFile(dashFile, 'utf8'), dashContent)
})

test('setup-auth refuses to rewrite an existing identity and preserves both legacy files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groupher-setup-auth-legacy-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const authFile = path.join(root, 'backend/auth/.env.local')
  const dashFile = path.join(root, 'frontend/dash/.env.local')
  await mkdir(path.dirname(authFile), { recursive: true })
  await mkdir(path.dirname(dashFile), { recursive: true })
  const authContent = 'SERVICE_AUTH_CLIENTS_JSON_EXTRA=legacy-auth-value\n'
  const dashContent = 'SERVICE_AUTH_CLIENT_ID=legacy-dash-id\n'
  await writeFile(authFile, authContent)
  await writeFile(dashFile, dashContent)

  await assert.rejects(() => setupLocalServiceAuth(root, {}), /migration --check.*--apply/)
  assert.equal(await readFile(authFile, 'utf8'), authContent)
  assert.equal(await readFile(dashFile, 'utf8'), dashContent)
  await assert.rejects(() => readFile(localEnvironmentPaths(root).state), { code: 'ENOENT' })
})
