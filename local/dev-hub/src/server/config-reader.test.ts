import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { ServiceConfigError, ServiceConfigReader } from './config-reader.ts'
import type { TServiceDefinition } from './services.ts'

const METRICS = {
  serverCpuPercent: 100,
  serverRssBytes: 1024 ** 3,
  browserBusyPercent: 50,
  browserHeapBytes: 512 * 1024 ** 2,
}

const createDefinition = (
  root: string,
  config: TServiceDefinition['config'],
): TServiceDefinition => ({
  id: 'fixture',
  name: 'Fixture',
  description: 'Configuration reader fixture.',
  group: 'frontend',
  monogram: 'FX',
  cwd: root,
  config,
  metrics: METRICS,
})

test('Next env manifests follow development precedence and redact values by default', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dev-hub-env-'))
  t.after(async () => rm(root, { recursive: true, force: true }))

  await Promise.all([
    writeFile(path.join(root, '.env.development.local'), 'TOKEN=top-secret\n# keep me\n'),
    writeFile(path.join(root, '.env.local'), 'LOCAL_URL=http://localhost\n'),
    writeFile(path.join(root, '.env.development'), 'PUBLIC_NAME=Groupher\n'),
    writeFile(path.join(root, '.env.example'), 'TOKEN=example\n'),
    writeFile(path.join(root, 'README.md'), 'not configuration\n'),
  ])

  const reader = new ServiceConfigReader(
    [
      createDefinition(root, {
        kind: 'next-env',
        root,
        environment: 'development',
      }),
    ],
    root,
  )
  const manifest = await reader.getManifest('fixture')

  assert.deepEqual(
    manifest.files.map(({ name, group }) => ({ name, group })),
    [
      { name: '.env.development.local', group: 'active' },
      { name: '.env.local', group: 'active' },
      { name: '.env.development', group: 'active' },
      { name: '.env.example', group: 'template' },
    ],
  )

  const sensitiveFile = manifest.files[0]
  assert.equal(sensitiveFile.sensitive, true)
  const redacted = await reader.getContent('fixture', sensitiveFile.id, false)
  assert.equal(redacted.redacted, true)
  assert.match(redacted.content, /TOKEN=••••••/)
  assert.doesNotMatch(redacted.content, /top-secret/)

  const revealed = await reader.getContent('fixture', sensitiveFile.id, true)
  assert.equal(revealed.redacted, false)
  assert.match(revealed.content, /TOKEN=top-secret/)
})

test('Elixir manifests identify the active environment and omit symbolic links', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dev-hub-config-'))
  const outsideRoot = await mkdtemp(path.join(tmpdir(), 'dev-hub-config-outside-'))
  t.after(async () => {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outsideRoot, { recursive: true, force: true }),
    ])
  })

  const outsideFile = path.join(outsideRoot, 'outside.exs')
  await Promise.all([
    writeFile(path.join(root, 'config.exs'), 'import Config\n'),
    writeFile(path.join(root, 'mock.exs'), 'config :app, :mode, :mock\n'),
    writeFile(path.join(root, 'mock.secret.exs'), 'config :app, :token, "secret"\n'),
    writeFile(path.join(root, 'runtime.exs'), 'import Config\n'),
    writeFile(path.join(root, 'dev.exs'), 'config :app, :mode, :dev\n'),
    writeFile(outsideFile, 'config :outside, true\n'),
  ])
  await symlink(outsideFile, path.join(root, 'linked.exs'))

  const reader = new ServiceConfigReader(
    [
      createDefinition(root, {
        kind: 'elixir-config',
        root,
        environment: 'mock',
      }),
    ],
    root,
  )
  const manifest = await reader.getManifest('fixture')

  assert.deepEqual(
    manifest.files.map(({ name, group }) => ({ name, group })),
    [
      { name: 'config.exs', group: 'active' },
      { name: 'mock.exs', group: 'active' },
      { name: 'mock.secret.exs', group: 'active' },
      { name: 'runtime.exs', group: 'active' },
      { name: 'dev.exs', group: 'other' },
    ],
  )

  const secret = manifest.files.find((file) => file.name === 'mock.secret.exs')
  assert.ok(secret)
  assert.equal(secret.sensitive, true)
  const redacted = await reader.getContent('fixture', secret.id, false)
  assert.equal(redacted.content, '# ••••••\n')

  await assert.rejects(
    () => reader.getContent('fixture', 'unknown', false),
    (error: unknown) => error instanceof ServiceConfigError && error.statusCode === 404,
  )
})
