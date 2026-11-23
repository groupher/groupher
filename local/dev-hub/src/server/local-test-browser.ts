/** Owns persistent, separate browser profiles for local synthetic identities. No HTTP listener. */
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { REPO_ROOT } from './services.ts'

type TOpen = {
  run: string
  alias: string
  community: string
  login: string
  headless: boolean
  app: 'dash' | 'community'
}
type TRequest = { id: string; action: 'open' | 'close'; actor?: TOpen }
const root = path.join(REPO_ROOT, 'local/dev-hub/.data/test-actors/browsers')
const NAME = /^[a-z][a-z0-9-]{0,39}$/
const read = async (file: string) => JSON.parse(await readFile(file, 'utf8').catch(() => 'null'))
const write = async (file: string, value: unknown) => {
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 })
  await rename(temporary, file)
}

const requestBrowser = async (profile: string, request: TRequest) => {
  await write(path.join(profile, 'request.json'), request)
  for (let i = 0; i < 240; i++) {
    const result = await read(path.join(profile, 'result.json'))
    if (result?.id === request.id) {
      if (result.error) throw new Error(result.error)
      return result.data
    }
    await delay(250)
  }
  throw new Error(
    'Browser did not become ready within 60 seconds. Inspect the local services and retry.',
  )
}

export const openActorBrowser = async (actor: TOpen) => {
  if (![actor.run, actor.alias].every((v) => NAME.test(v)))
    throw new Error('Invalid browser profile identity.')
  const profile = path.join(root, actor.run, actor.alias)
  await mkdir(profile, { recursive: true, mode: 0o700 })
  const state = await read(path.join(profile, 'worker.json'))
  let alive = false
  if (state?.pid) {
    try {
      process.kill(state.pid, 0)
      alive = true
    } catch {}
  }
  if (!alive) {
    const env = Object.fromEntries(
      ['PATH', 'HOME', 'TMPDIR', 'LANG', 'DISPLAY', 'XAUTHORITY', 'SystemRoot'].flatMap((key) =>
        process.env[key] ? [[key, process.env[key]!]] : [],
      ),
    )
    const child = fork(
      fileURLToPath(import.meta.url),
      ['--worker', profile, actor.headless ? 'headless' : 'headed'],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env,
      },
    )
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error('Local browser failed to start. Check that Chrome/Chromium is installed.'),
          ),
        30_000,
      )
      child.once('error', reject)
      child.once('exit', () => {
        clearTimeout(timer)
        reject(new Error('Local browser worker exited before startup.'))
      })
      child.once('message', (message: any) => {
        clearTimeout(timer)
        if (message.error) reject(new Error(message.error))
        else resolve()
      })
    })
    child.disconnect()
    child.unref()
  }
  return requestBrowser(profile, { id: randomUUID(), action: 'open', actor })
}

export const closeActorBrowsers = async (run: string) => {
  if (!NAME.test(run)) throw new Error('Invalid run.')
  const runRoot = path.join(root, run)
  for (const alias of await readdir(runRoot).catch(() => [])) {
    if (!NAME.test(alias)) continue
    const profile = path.join(runRoot, alias)
    const state = await read(path.join(profile, 'worker.json'))
    if (!state?.pid) continue
    try {
      process.kill(state.pid, 0)
    } catch {
      continue
    }
    await requestBrowser(profile, { id: randomUUID(), action: 'close' })
    for (let i = 0; i < 40; i++) {
      if (!(await read(path.join(profile, 'worker.json')))?.pid) break
      if (i === 39)
        throw new Error('Browser is still closing; retry clean before deleting its profile.')
      await delay(250)
    }
  }
}

/** Deletes only a validated run's private profiles, after its workers have stopped. */
export const cleanActorBrowsers = async (run: string) => {
  if (!NAME.test(run)) throw new Error('Invalid run.')
  await closeActorBrowsers(run)
  const runRoot = path.join(root, run)
  const actual = await realpath(runRoot).catch(() => null)
  if (!actual) return
  if (actual !== path.join(await realpath(root), run))
    throw new Error('Refusing to clean a symlinked browser run.')
  await rm(runRoot, { recursive: true })
}

async function worker(profile: string, headless: boolean) {
  const require = createRequire(path.join(REPO_ROOT, 'package.json'))
  const { chromium } = require('@playwright/test') as typeof import('@playwright/test')
  const context = await chromium.launchPersistentContext(path.join(profile, 'chrome'), {
    channel: 'chrome',
    headless,
    viewport: { width: 1440, height: 1000 },
  })
  await write(path.join(profile, 'worker.json'), { pid: process.pid })
  context.once('close', () => {
    void write(path.join(profile, 'worker.json'), { pid: null }).finally(() => process.exit())
  })
  process.on('SIGTERM', () => {
    void context.close()
  })
  const page = context.pages()[0] || (await context.newPage())
  let previous = ''
  let busy = false
  const poll = setInterval(async () => {
    if (busy) return
    busy = true
    const request = (await read(path.join(profile, 'request.json'))) as TRequest | null
    try {
      if (!request || request.id === previous) return
      previous = request.id
      if (request.action === 'close') {
        await write(path.join(profile, 'result.json'), { id: request.id, data: { closed: true } })
        clearInterval(poll)
        await context.close()
        return
      }
      const actor = request.actor!
      if (
        !actor ||
        ![actor.run, actor.alias].every((v) => NAME.test(v)) ||
        path.join(root, actor.run, actor.alias) !== profile
      )
        throw new Error('Browser identity does not match the owned profile.')
      if (!['dash', 'community'].includes(actor.app)) throw new Error('Invalid local application.')
      const url = `https://${actor.app}.groupher.localhost/${encodeURIComponent(actor.community)}/${actor.app === 'dash' ? 'overview' : 'post'}`
      await page.goto(`https://${actor.app}.groupher.localhost/health`, {
        waitUntil: 'domcontentloaded',
      })
      const status = await page.evaluate(async (actor) => {
        const response = await fetch('https://auth.groupher.localhost/api/auth/test-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
          body: JSON.stringify({
            localActor: {
              run: actor.run,
              alias: actor.alias,
              community: actor.community,
              app: actor.app,
            },
          }),
        })
        return response.status
      }, actor)
      if (status !== 204)
        throw new Error(
          `Local Auth rejected the account (${status}). Restart Auth/Phoenix through Dev Hub if configuration changed.`,
        )
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
      const viewer = await page.evaluate(async () => {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
          body: JSON.stringify({ query: '{ sessionState { isValid user { login } } }' }),
        })
        const result = await response.json()
        return result.data?.sessionState
      })
      if (!viewer?.isValid || viewer.user?.login !== actor.login)
        throw new Error('Dash viewer did not match the selected account.')
      const text = await page.locator('body').innerText()
      if (/Sign in required|Sign in to continue|Internal Server Error/.test(text))
        throw new Error('Dash did not render the authenticated community page.')
      const screenshots = path.join(REPO_ROOT, '.playwright')
      await mkdir(screenshots, { recursive: true })
      const screenshot = path.join(screenshots, `local-test-${actor.run}-${actor.alias}.png`)
      await page.screenshot({ path: screenshot })
      await write(path.join(profile, 'result.json'), {
        id: request.id,
        data: {
          login: actor.login,
          community: actor.community,
          url: page.url(),
          title: await page.title(),
          screenshot,
        },
      })
    } catch (error) {
      await write(path.join(profile, 'result.json'), {
        id: request?.id,
        error: error instanceof Error ? error.message : 'Browser operation failed.',
      })
    } finally {
      busy = false
    }
  }, 250)
  process.send?.({ ready: true })
}

if (process.argv[2] === '--worker') {
  worker(process.argv[3], process.argv[4] === 'headless').catch((error) => {
    process.send?.({ error: error instanceof Error ? error.message : 'Browser failed.' })
    process.exitCode = 1
  })
}
