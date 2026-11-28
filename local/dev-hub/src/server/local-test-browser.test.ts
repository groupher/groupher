import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertActorUIPageLocation,
  assertActorUIPath,
  assertActorUILinkHref,
  validateActorUIOperation,
} from './local-test-browser.ts'

test('actor UI navigation stays on the selected app origin and actor community routes', () => {
  assert.equal(
    assertActorUIPath('/demo-one/docs/page-1', 'demo-one', 'dash'),
    'https://dash.groupher.localhost/demo-one/docs/page-1',
  )
  assert.equal(
    assertActorUIPath('/home/post', 'demo-one', 'community'),
    'https://community.groupher.localhost/home/post',
  )
  assert.equal(
    assertActorUIPath('/demo-one/', 'demo-one', 'dash'),
    'https://dash.groupher.localhost/demo-one/',
  )

  for (const path of [
    'https://evil.example/',
    '//evil.example/',
    '/other-community/docs',
    '/demo-one/%2e%2e/home',
    '/demo-one/docs?next=/home',
    '/demo-one/docs#section',
    '/demo-one\\docs',
    '/demo-one/%2f%2fevil',
  ])
    assert.throws(() => assertActorUIPath(path, 'demo-one', 'dash'))
})

test('actor UI link actions reject external or out-of-scope destinations', () => {
  assert.equal(
    assertActorUILinkHref('/demo-one/docs/page-1', 'demo-one', 'community'),
    'https://community.groupher.localhost/demo-one/docs/page-1',
  )
  for (const href of [
    null,
    'https://evil.example/',
    '//evil.example/',
    '/other-community/docs',
    '/demo-one/docs?next=/home',
    '/demo-one/docs#section',
    'javascript:alert(1)',
  ])
    assert.throws(() => assertActorUILinkHref(href, 'demo-one', 'community'))
})

test('actor UI page location remains on allowed app routes after each interaction', () => {
  assert.doesNotThrow(() =>
    assertActorUIPageLocation('https://dash.groupher.localhost/demo-one/docs', 'demo-one', 'dash'),
  )
  assert.doesNotThrow(() =>
    assertActorUIPageLocation(
      'https://community.groupher.localhost/home/post',
      'demo-one',
      'community',
    ),
  )
  for (const url of [
    'https://evil.example/demo-one/docs',
    'https://community.groupher.localhost/other-community/post',
    'https://dash.groupher.localhost/demo-one/docs?secret=1',
  ])
    assert.throws(() => assertActorUIPageLocation(url, 'demo-one', 'dash'))
})

test('secondary browser actions remain within their own sibling domain', () => {
  const root = 'groupher-feature.localhost'
  assert.equal(
    assertActorUIPath('/home/overview', 'demo-one', 'dash', root),
    'https://dash.groupher-feature.localhost/home/overview',
  )
  assert.throws(() =>
    assertActorUIPageLocation(
      'https://dash.groupher.localhost/home/overview',
      'demo-one',
      'dash',
      root,
    ),
  )
  assert.throws(() => assertActorUIPath('/home/overview', 'demo-one', 'dash', 'evil.example'))
})

test('worker UI operations accept only accessible locator operations and the key allowlist', () => {
  for (const operation of [
    { op: 'snapshot' },
    { op: 'navigate', path: '/demo-one/docs' },
    { op: 'click', role: 'button', name: 'Save' },
    { op: 'fill', role: 'textbox', name: 'Title', value: 'Docs' },
    { op: 'press', key: 'Enter' },
    { op: 'assert-text', text: 'Saved' },
  ] as const)
    assert.doesNotThrow(() => validateActorUIOperation(operation))

  assert.throws(() =>
    validateActorUIOperation({ op: 'click', role: 'document', name: 'x' } as never),
  )
  assert.throws(() =>
    validateActorUIOperation({ op: 'fill', role: 'button', name: 'x', value: 'y' } as never),
  )
  assert.throws(() => validateActorUIOperation({ op: 'press', key: 'Control+C' } as never))
  assert.throws(() =>
    validateActorUIOperation({ op: 'evaluate', expression: 'document.cookie' } as never),
  )
})

test('reaps only abandoned ephemeral runs with no live workers', async (t) => {
  const { mkdtemp, mkdir, writeFile, access, rm, symlink } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { cleanAbandonedBrowserRuns, registerEphemeralBrowserRun } =
    await import('./local-test-browser.ts')
  const root = await mkdtemp(path.join(tmpdir(), 'actor-browsers-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await registerEphemeralBrowserRun('running', root)
  await mkdir(path.join(root, 'manual'))
  await mkdir(path.join(root, 'abandoned', 'editor'), { recursive: true })
  await writeFile(
    path.join(root, 'abandoned', 'ephemeral.json'),
    JSON.stringify({ pid: 2147483647 }),
  )
  await writeFile(
    path.join(root, 'abandoned', 'editor', 'worker.json'),
    JSON.stringify({ pid: null }),
  )
  await mkdir(path.join(root, 'live-worker', 'editor'), { recursive: true })
  await writeFile(
    path.join(root, 'live-worker', 'ephemeral.json'),
    JSON.stringify({ pid: 2147483647 }),
  )
  await writeFile(
    path.join(root, 'live-worker', 'editor', 'worker.json'),
    JSON.stringify({ pid: process.pid }),
  )
  await mkdir(path.join(root, 'live-chrome', 'editor', 'chrome'), { recursive: true })
  await writeFile(
    path.join(root, 'live-chrome', 'ephemeral.json'),
    JSON.stringify({ pid: 2147483647 }),
  )
  await writeFile(
    path.join(root, 'live-chrome', 'editor', 'worker.json'),
    JSON.stringify({ pid: null }),
  )
  await symlink(
    `host-${process.pid}`,
    path.join(root, 'live-chrome', 'editor', 'chrome', 'SingletonLock'),
  )
  await cleanAbandonedBrowserRuns(root)
  await assert.rejects(access(path.join(root, 'abandoned')), { code: 'ENOENT' })
  await access(path.join(root, 'running'))
  await access(path.join(root, 'manual'))
  await access(path.join(root, 'live-worker'))
  await access(path.join(root, 'live-chrome'))
})

test('browser cleanup refuses symlinked runs before touching their contents', async (t) => {
  const { mkdtemp, mkdir, writeFile, readFile, rm, symlink } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { cleanActorBrowsers } = await import('./local-test-browser.ts')
  const base = await mkdtemp(path.join(tmpdir(), 'actor-symlink-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const root = path.join(base, 'browsers')
  const target = path.join(base, 'unrelated')
  await mkdir(root)
  await mkdir(target)
  await writeFile(path.join(target, 'keep'), 'unchanged')
  await symlink(target, path.join(root, 'demo'))
  await assert.rejects(() => cleanActorBrowsers('demo', root), /symlinked/)
  assert.equal(await readFile(path.join(target, 'keep'), 'utf8'), 'unchanged')
})

test('browser cleanup retains a profile owned by a live Chrome process', async (t) => {
  const { mkdtemp, mkdir, writeFile, access, rm, symlink } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { cleanActorBrowsers } = await import('./local-test-browser.ts')
  const root = await mkdtemp(path.join(tmpdir(), 'actor-live-profile-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const profile = path.join(root, 'demo', 'editor')
  await mkdir(path.join(profile, 'chrome'), { recursive: true })
  await writeFile(path.join(profile, 'worker.json'), JSON.stringify({ pid: null }))
  await symlink(`host-${process.pid}`, path.join(profile, 'chrome', 'SingletonLock'))
  await assert.rejects(() => cleanActorBrowsers('demo', root), /browser still owns/)
  await access(profile)
})

test('an interrupted ephemeral owner is reaped only after it exits', async (t) => {
  const { spawn } = await import('node:child_process')
  const { once } = await import('node:events')
  const { mkdtemp, mkdir, writeFile, access, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { cleanAbandonedBrowserRuns } = await import('./local-test-browser.ts')
  const root = await mkdtemp(path.join(tmpdir(), 'actor-interrupted-'))
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
    await rm(root, { recursive: true, force: true })
  })
  assert.ok(child.pid)
  const run = path.join(root, 'automated')
  await mkdir(path.join(run, 'editor'), { recursive: true })
  await writeFile(path.join(run, 'ephemeral.json'), JSON.stringify({ pid: child.pid }))
  await writeFile(path.join(run, 'editor', 'worker.json'), JSON.stringify({ pid: null }))
  await cleanAbandonedBrowserRuns(root)
  await access(run)
  const exited = once(child, 'exit')
  child.kill()
  await exited
  await cleanAbandonedBrowserRuns(root)
  await assert.rejects(access(run), { code: 'ENOENT' })
})
