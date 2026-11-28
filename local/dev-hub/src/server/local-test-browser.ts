/** Owns persistent, separate browser profiles for local synthetic identities. No HTTP listener. */
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { verifyLocalTestViewer } from './local-test-viewer.ts'
import { REPO_ROOT } from './services.ts'
import { userDataRoot } from './storage-paths.ts'

type TOpen = {
  run: string
  alias: string
  community: string
  login: string
  headless: boolean
  app: 'dash' | 'community'
  publicRoot?: string
}
export const ACTOR_UI_ROLES = [
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'menuitem',
  'tab',
] as const
export type TActorUIRole = (typeof ACTOR_UI_ROLES)[number]
export const ACTOR_UI_KEYS = [
  'Enter',
  'Tab',
  'Escape',
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Delete',
  'Home',
  'End',
] as const
export type TActorUIKey = (typeof ACTOR_UI_KEYS)[number]
export type TActorUIOperation =
  | { op: 'snapshot' }
  | { op: 'navigate'; path: string }
  | { op: 'click'; role: TActorUIRole; name: string }
  | { op: 'fill'; role: 'textbox' | 'combobox'; name: string; value: string }
  | { op: 'press'; key: TActorUIKey }
  | { op: 'assert-text'; text: string }
type TRequest = {
  id: string
  action: 'open' | 'close' | 'ui'
  actor?: TOpen
  operation?: TActorUIOperation
}
export const actorBrowserRoot = (repoRoot = REPO_ROOT) =>
  path.join(userDataRoot(repoRoot), 'browsers')
const root = actorBrowserRoot()
const NAME = /^[a-z][a-z0-9-]{0,39}$/
const publicRoot = (value = 'groupher.localhost') => {
  if (!/^groupher(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\.localhost$/.test(value))
    throw new Error('Invalid local browser environment.')
  return value
}
const read = async (file: string) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
const write = async (file: string, value: unknown) => {
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 })
  await rename(temporary, file)
}

const processAlive = (pid: unknown): boolean => {
  if (!Number.isSafeInteger(pid) || (pid as number) <= 0) return false
  try {
    process.kill(pid as number, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Chromium's singleton lock identifies a browser that can outlive its worker. */
const browserProfileBusy = async (profile: string): Promise<boolean> => {
  const lock = path.join(profile, 'chrome', 'SingletonLock')
  let info
  try {
    info = await lstat(lock)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  if (!info.isSymbolicLink()) return true
  const target = await readlink(lock).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (target === null) return false
  const match = target.match(/-(\d+)$/)
  return !match || Number(match[1]) <= 0 || processAlive(Number(match[1]))
}

/** Register a newly created run before opening any browser profiles. */
export const registerEphemeralBrowserRun = async (run: string, browserRoot = root) => {
  if (!NAME.test(run)) throw new Error('Invalid run.')
  await mkdir(browserRoot, { recursive: true, mode: 0o700 })
  const runRoot = path.join(browserRoot, run)
  await mkdir(runRoot, { mode: 0o700 })
  try {
    await writeFile(path.join(runRoot, 'ephemeral.json'), JSON.stringify({ pid: process.pid }), {
      flag: 'wx',
      mode: 0o600,
    })
  } catch (error) {
    await rm(runRoot, { recursive: true, force: true })
    throw error
  }
}

/** Reap only abandoned ephemeral runs whose owner and all browser workers have exited. */
export const cleanAbandonedBrowserRuns = async (browserRoot = root) => {
  const entries = await readdir(browserRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  for (const entry of entries) {
    if (!entry.isDirectory() || !NAME.test(entry.name)) continue
    const runRoot = path.join(browserRoot, entry.name)
    const marker = await read(path.join(runRoot, 'ephemeral.json')).catch(() => null)
    if (!marker || !Number.isSafeInteger(marker.pid) || marker.pid <= 0 || processAlive(marker.pid))
      continue
    const aliases = await readdir(runRoot, { withFileTypes: true })
    let active = false
    for (const alias of aliases) {
      if (!alias.isDirectory() || !NAME.test(alias.name)) continue
      const state = await read(path.join(runRoot, alias.name, 'worker.json')).catch(() => undefined)
      if (
        !state ||
        (state.pid !== null &&
          (!Number.isSafeInteger(state.pid) || state.pid <= 0 || processAlive(state.pid))) ||
        (await browserProfileBusy(path.join(runRoot, alias.name)))
      ) {
        active = true
        break
      }
    }
    if (!active) await rm(runRoot, { recursive: true })
  }
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
      [
        'PATH',
        'HOME',
        'TMPDIR',
        'LANG',
        'DISPLAY',
        'XAUTHORITY',
        'SystemRoot',
        'XDG_DATA_HOME',
        'LOCALAPPDATA',
        'USERPROFILE',
      ].flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : [])),
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

export const assertActorUIPath = (
  pathname: string,
  community: string,
  app: TOpen['app'],
  root = 'groupher.localhost',
): string => {
  if (
    typeof pathname !== 'string' ||
    pathname.length > 512 ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    /[\\?#\u0000-\u001f]/.test(pathname)
  )
    throw new Error('UI navigation requires a local app path.')

  let decodedSegments: string[]
  try {
    decodedSegments = pathname
      .split('/')
      .slice(1)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    throw new Error('UI navigation path is invalid.')
  }
  if (decodedSegments.at(-1) === '') decodedSegments.pop()
  if (
    decodedSegments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\'),
    ) ||
    ![community, 'home'].includes(decodedSegments[0] || '')
  )
    throw new Error('UI navigation is limited to the actor community or /home.')

  const origin = `https://${app}.${publicRoot(root)}`
  const target = new URL(pathname, origin)
  if (target.origin !== origin || target.pathname !== pathname || target.search || target.hash)
    throw new Error('UI navigation is limited to the actor app origin and path.')
  return target.href
}

export const assertActorUILinkHref = (
  href: string | null,
  community: string,
  app: TOpen['app'],
  root = 'groupher.localhost',
): string => {
  if (!href || href.length > 512) throw new Error('UI links require a bounded local href.')
  const origin = `https://${app}.${publicRoot(root)}`
  const target = new URL(href, origin)
  if (target.search || target.hash || target.origin !== origin)
    throw new Error('UI links are limited to an allowed local app route.')
  assertActorUIPath(target.pathname, community, app, root)
  return target.href
}

export const assertActorUIPageLocation = (
  pageUrl: string,
  community: string,
  app: TOpen['app'],
  root = 'groupher.localhost',
): void => {
  const current = new URL(pageUrl)
  const origin = `https://${app}.${publicRoot(root)}`
  if (current.origin !== origin || current.search || current.hash)
    throw new Error('Actor browser is outside its allowed application route.')
  assertActorUIPath(current.pathname, community, app, root)
}

export const validateActorUIOperation = (operation: TActorUIOperation): void => {
  if (!operation || typeof operation !== 'object' || !('op' in operation))
    throw new Error('Invalid actor UI operation.')
  if (operation.op === 'navigate') {
    if (typeof operation.path !== 'string' || operation.path.length > 512)
      throw new Error('UI navigation requires a local app path.')
  } else if (operation.op === 'click') {
    if (
      !ACTOR_UI_ROLES.includes(operation.role) ||
      typeof operation.name !== 'string' ||
      operation.name.length === 0 ||
      operation.name.length > 120
    )
      throw new Error('UI click requires an allowed accessible role and name.')
  } else if (operation.op === 'fill') {
    if (
      !['textbox', 'combobox'].includes(operation.role) ||
      typeof operation.name !== 'string' ||
      operation.name.length > 120 ||
      typeof operation.value !== 'string' ||
      operation.value.length > 1000
    )
      throw new Error('UI fill requires a textbox or combobox role, name and bounded value.')
  } else if (operation.op === 'press') {
    if (!ACTOR_UI_KEYS.includes(operation.key)) throw new Error('UI key is not allowed.')
  } else if (operation.op === 'assert-text') {
    if (
      typeof operation.text !== 'string' ||
      operation.text.length === 0 ||
      operation.text.length > 250
    )
      throw new Error('UI text assertion requires bounded visible text.')
  } else if (operation.op !== 'snapshot') {
    throw new Error('Unsupported actor UI operation.')
  }
}

export const operateActorBrowser = async (actor: TOpen, operation: TActorUIOperation) => {
  if (![actor.run, actor.alias].every((value) => NAME.test(value)))
    throw new Error('Invalid browser profile identity.')
  validateActorUIOperation(operation)

  const profile = path.join(root, actor.run, actor.alias)
  const actual = await realpath(profile).catch(() => null)
  if (!actual || actual !== path.join(await realpath(root), actor.run, actor.alias))
    throw new Error('Actor browser profile is unavailable.')
  const state = await read(path.join(profile, 'worker.json'))
  if (!Number.isSafeInteger(state?.pid)) throw new Error('Actor browser is not open.')
  try {
    process.kill(state.pid, 0)
  } catch {
    throw new Error('Actor browser is not open.')
  }

  return requestBrowser(profile, { id: randomUUID(), action: 'ui', actor, operation })
}

const ownedRunRoot = async (run: string, browserRoot: string): Promise<string | null> => {
  if (!NAME.test(run)) throw new Error('Invalid run.')
  const runRoot = path.join(browserRoot, run)
  let actual: string
  try {
    actual = await realpath(runRoot)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  if (actual !== path.join(await realpath(browserRoot), run))
    throw new Error('Refusing to access a symlinked browser run.')
  return runRoot
}

export const closeActorBrowsers = async (run: string, browserRoot = root) => {
  const runRoot = await ownedRunRoot(run, browserRoot)
  if (!runRoot) return
  for (const entry of await readdir(runRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !NAME.test(entry.name)) continue
    const profile = path.join(runRoot, entry.name)
    const state = await read(path.join(profile, 'worker.json'))
    if (!state || state.pid === null) continue
    if (!Number.isSafeInteger(state.pid) || state.pid <= 0)
      throw new Error('Invalid browser worker state; refusing to clean this profile.')
    if (!processAlive(state.pid)) continue
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
export const cleanActorBrowsers = async (run: string, browserRoot = root) => {
  const runRoot = await ownedRunRoot(run, browserRoot)
  if (!runRoot) return
  await closeActorBrowsers(run, browserRoot)
  for (const alias of await readdir(runRoot, { withFileTypes: true })) {
    if (
      alias.isDirectory() &&
      NAME.test(alias.name) &&
      (await browserProfileBusy(path.join(runRoot, alias.name)))
    ) {
      throw new Error('A browser still owns this profile; close it before cleanup.')
    }
  }
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
      if (request.action === 'ui') {
        if (!request.operation) throw new Error('Actor UI operation is missing.')
        validateActorUIOperation(request.operation)
        assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)

        if (request.operation.op === 'navigate') {
          await page.goto(
            assertActorUIPath(request.operation.path, actor.community, actor.app, actor.publicRoot),
            {
              waitUntil: 'networkidle',
              timeout: 45_000,
            },
          )
          assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)
          await write(path.join(profile, 'result.json'), {
            id: request.id,
            data: { url: page.url(), title: await page.title() },
          })
          return
        }

        if (request.operation.op === 'snapshot') {
          const visibleText = (await page.locator('body').innerText()).slice(0, 4_000)
          const controlSnapshots: string[] = []
          for (const role of [
            'button',
            'link',
            'textbox',
            'checkbox',
            'radio',
            'combobox',
            'menuitem',
            'tab',
          ] as const) {
            const controls = await page.getByRole(role).all()
            for (const control of controls.slice(0, 40)) {
              controlSnapshots.push(await control.ariaSnapshot())
            }
            if (controlSnapshots.length >= 100) break
          }
          await write(path.join(profile, 'result.json'), {
            id: request.id,
            data: {
              url: page.url(),
              title: await page.title(),
              visibleText,
              controls: controlSnapshots.join('\n').slice(0, 4_000),
            },
          })
          return
        }

        if (request.operation.op === 'assert-text') {
          const visibleText = await page.locator('body').innerText()
          const matched = visibleText.includes(request.operation.text)
          if (!matched) throw new Error('Expected visible text was not found.')
          assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)
          await write(path.join(profile, 'result.json'), { id: request.id, data: { matched } })
          return
        }

        if (request.operation.op === 'press') {
          await page.keyboard.press(request.operation.key)
          assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)
          await write(path.join(profile, 'result.json'), {
            id: request.id,
            data: { pressed: true },
          })
          return
        }

        const locator = page.getByRole(request.operation.role, {
          name: request.operation.name,
          exact: true,
        })
        const count = await locator.count()
        if (count !== 1)
          throw new Error(
            `Expected exactly one accessible ${request.operation.role}; found ${count}.`,
          )
        if (request.operation.op === 'click') {
          if (request.operation.role === 'link') {
            const href = assertActorUILinkHref(
              await locator.getAttribute('href'),
              actor.community,
              actor.app,
              actor.publicRoot,
            )
            const target = await locator.getAttribute('target')
            if (target && target !== '_self')
              throw new Error('UI links cannot open another browsing context.')
            if (new URL(href).origin !== new URL(page.url()).origin)
              throw new Error('UI links must stay on the current actor app origin.')
          }
          await locator.click()
          assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)
          await write(path.join(profile, 'result.json'), {
            id: request.id,
            data: { clicked: true },
          })
          return
        }
        if (request.operation.op === 'fill') {
          if ((await locator.getAttribute('contenteditable')) === 'true') {
            await locator.click()
            await locator.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
            await locator.press('Backspace')
            await locator.pressSequentially(request.operation.value)
          } else {
            await locator.fill(request.operation.value)
          }
          assertActorUIPageLocation(page.url(), actor.community, actor.app, actor.publicRoot)
          await write(path.join(profile, 'result.json'), { id: request.id, data: { filled: true } })
          return
        }
        throw new Error('Unsupported actor UI operation.')
      }
      const domain = publicRoot(actor.publicRoot)
      const url = `https://${actor.app}.${domain}/${encodeURIComponent(actor.community)}/${actor.app === 'dash' ? 'overview' : 'post'}`
      await page.goto(`https://${actor.app}.${domain}/health`, {
        waitUntil: 'domcontentloaded',
      })
      const status = await page.evaluate(async (actor) => {
        const response = await fetch(
          `https://auth.${actor.publicRoot || 'groupher.localhost'}/api/auth/test-login`,
          {
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
          },
        )
        return response.status
      }, actor)
      if (status !== 204)
        throw new Error(
          `Local Auth rejected the account (${status}). Restart Auth/Phoenix through Dev Hub if configuration changed.`,
        )
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
      await page.evaluate(verifyLocalTestViewer, actor.login)
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
