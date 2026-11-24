/** Real local acceptance: CLI fixtures -> Auth cookies -> Dash viewer -> revoke. No servers launched. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { runHubCommand } from '../src/server/cli.ts'
import { REPO_ROOT } from '../src/server/services.ts'

const require = createRequire(path.join(REPO_ROOT, 'package.json'))
const { chromium } = require('@playwright/test') as typeof import('@playwright/test')
const run = `actors-smoke-${randomBytes(4).toString('hex')}`
const clean = process.argv.includes('--clean')
if (process.argv.slice(2).some((arg) => arg !== '--clean'))
  throw new Error('Only --clean is accepted.')
const invoke = (args: string[]) => runHubCommand(args)
const actor = (action: string, ...flags: string[]) =>
  invoke(['actors', action, '--run', run, ...flags])
const evidence: Record<string, unknown> = { run, checks: [] }
const checks = evidence.checks as string[]
let created = false
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const auth = 'https://auth.groupher.localhost/api/auth/test-login'
const headers = { Origin: 'https://dash.groupher.localhost', 'X-Groupher-CSRF': '1' }
try {
  const owner = ((await actor('create', '--alias', 'owner')) as Array<{ login: string }>)[0]
  created = true
  await actor('create', '--alias', 'editor')
  await actor('create', '--alias', 'outsider')
  const reused = ((await actor('create', '--alias', 'owner')) as Array<{ login: string }>)[0]
  assert.equal(reused.login, owner.login)
  checks.push('random account creation and stable alias reuse')
  await invoke(['communities', 'create', '--run', run, '--owner', 'owner', '--slug', run])
  await invoke(['communities', 'create', '--run', run, '--owner', 'owner', '--slug', run])
  checks.push('community creation, lord initialization and retry')
  await actor(
    'grant',
    '--as',
    'editor',
    '--community',
    run,
    '--by',
    'owner',
    '--permissions',
    'dashboard.theme.update',
  )
  const rows = (await actor('list')) as Array<{
    alias: string
    communities: Array<{ isLord: boolean; permissions: Record<string, boolean> }>
  }>
  const editor = rows.find((row) => row.alias === 'editor')!
  assert.equal(editor.communities[0].isLord, false)
  assert.deepEqual(editor.communities[0].permissions, { 'dashboard.theme.update': true })
  checks.push('ordinary scoped Admin invite and acceptance')
  await assert.rejects(actor('open', '--as', 'outsider', '--community', run), /admin_required/)
  await assert.rejects(actor('open', '--as', 'owner', '--community', 'home'), /admin_required/)
  await assert.rejects(
    actor(
      'grant',
      '--as',
      'editor',
      '--community',
      run,
      '--by',
      'owner',
      '--permissions',
      'article.update',
    ),
    /scope_mismatch/,
  )
  checks.push('outsider, cross-community and wrong-scope rejection')
  evidence.dash = await actor('open', '--as', 'editor', '--community', run, '--headless')
  checks.push('no-UI login and authenticated Dash rendering in an independent profile')
  const denied = await fetch('http://127.0.0.1:3004/api/auth/test-login', {
    method: 'POST',
    headers: {
      ...headers,
      Host: 'auth.groupher.localhost',
      Origin: 'https://dash.groupher.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localActor: { run, alias: 'owner', community: run } }),
  })
  assert.equal(denied.status, 404)
  await page.goto('https://dash.groupher.localhost/health')
  const login = () =>
    page.evaluate(
      async ({ auth, run }) => {
        const result = await fetch(auth, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
          body: JSON.stringify({ localActor: { run, alias: 'owner', community: run } }),
        })
        return result.status
      },
      { auth, run },
    )
  assert.equal(await login(), 204)
  const viewer = () =>
    page.evaluate(async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
        body: JSON.stringify({ query: '{ sessionState { isValid user { login } } }' }),
      })
      return (await response.json()).data?.sessionState
    })
  assert.equal((await viewer()).user.login, owner.login)
  const unauthenticated = await fetch('http://127.0.0.1:4001/__local-test/actors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'actor.list', run }),
  })
  assert.equal(unauthenticated.status, 403)
  checks.push('production Origin and unauthenticated management rejection')
  await actor('close')
  assert.notEqual((await viewer())?.isValid, true)
  assert.equal(await login(), 403)
  await assert.rejects(actor('create', '--alias', 'new-account'), /run_closed/)
  checks.push('session revocation, browser closure and sealed-run rejection')
  if (clean) {
    const plan = (await actor('clean')) as { status: string; admins: number }
    assert.equal(plan.status, 'report')
    assert.ok(plan.admins > 0)
    const cleaned = (await actor('clean', '--apply')) as {
      status: string
      admins: number
      communities_to_archive: unknown[]
    }
    assert.equal(cleaned.status, 'cleaned')
    assert.equal(cleaned.admins, 0)
    assert.deepEqual(cleaned.communities_to_archive, [])
    await assert.rejects(
      access(path.join(REPO_ROOT, 'local/dev-hub/.data/test-actors/browsers', run)),
    )
    assert.equal(((await actor('clean', '--apply')) as { status: string }).status, 'cleaned')
    checks.push(
      'optional cleanup archives owned community, removes grants and browser profiles; repeat is safe',
    )
  }
  evidence.status = 'passed'
} finally {
  if (created && evidence.status !== 'passed') await actor('close').catch(() => {})
  await browser.close()
  await mkdir(path.join(REPO_ROOT, '.playwright'), { recursive: true })
  await writeFile(
    path.join(REPO_ROOT, '.playwright/local-test-actors-acceptance.json'),
    JSON.stringify(evidence, null, 2),
  )
}
console.log(JSON.stringify(evidence, null, 2))
