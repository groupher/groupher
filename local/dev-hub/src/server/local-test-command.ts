/** Local fixture CLI. No target URL, database override or force option is accepted. */
import { randomBytes } from 'node:crypto'

import { localTestActorsSecret, prepareLocalEnvironment } from './local-environment.ts'
import { openActorBrowser, closeActorBrowsers, cleanActorBrowsers } from './local-test-browser.ts'

type TOptions = Record<string, string | boolean>
const NAME = /^[a-z][a-z0-9-]{0,39}$/
const USAGE =
  'Usage: pnpm devhub actors create|list|grant|open|close|clean --run <name> ... | communities create --run <name> --owner <alias> [--slug <slug>]'

export const assertLocalTestTarget = (origin: string, env: NodeJS.ProcessEnv = process.env) => {
  const url = new URL(origin)
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    env.CI === 'true' ||
    !['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT', 'MIX_ENV'].every((key) =>
      ['', 'dev', 'development', 'local'].includes(env[key]?.trim().toLowerCase() || ''),
    )
  ) {
    throw new Error('Test actors are available only through the local development Hub.')
  }
}

export const parseLocalTestCommand = (args: string[]): { command: string; options: TOptions } => {
  const [area, action, ...flags] = args
  const commands: Record<string, string[]> = {
    'actors.create': ['run', 'alias', 'count'],
    'actors.list': ['run'],
    'actors.grant': [
      'run',
      'as',
      'community',
      'article',
      'scope',
      'role',
      'permissions',
      'by',
      'pending',
    ],
    'actors.open': ['run', 'as', 'community', 'headless', 'app'],
    'actors.close': ['run'],
    'actors.clean': ['run', 'apply'],
    'communities.create': ['run', 'owner', 'slug', 'title'],
  }
  const allowed = commands[`${area}.${action}`]
  if (!allowed) throw new Error(USAGE)
  const options: TOptions = {}
  for (let i = 0; i < flags.length; i++) {
    const key = flags[i]?.slice(2)
    if (!flags[i]?.startsWith('--') || !allowed.includes(key) || Object.hasOwn(options, key))
      throw new Error(USAGE)
    if (key === 'pending' || key === 'headless' || key === 'apply') options[key] = true
    else {
      const value = flags[++i]
      if (!value || value.startsWith('--')) throw new Error(USAGE)
      options[key] = value
    }
  }
  if (typeof options.run !== 'string' || !NAME.test(options.run))
    throw new Error('A valid --run is required (lowercase letters, digits and hyphens; max 40).')
  for (const key of ['as', 'alias', 'owner', 'by']) {
    if (
      options[key] !== undefined &&
      (typeof options[key] !== 'string' || !NAME.test(options[key] as string))
    )
      throw new Error(`Invalid --${key}.`)
  }
  if (['grant', 'open'].includes(action) && !options.as) throw new Error('--as is required.')
  if (action === 'open' && !options.community) throw new Error('--community is required for Dash.')
  if (options.app && !['dash', 'community'].includes(String(options.app)))
    throw new Error('--app must be dash or community.')
  if (area === 'communities' && !options.owner) throw new Error('--owner is required.')
  if (action === 'grant') {
    const scopes = [options.community, options.article, options.scope].filter(Boolean)
    if (scopes.length !== 1 || (options.scope && options.scope !== 'global'))
      throw new Error('Choose exactly one of --community, --article or --scope global.')
    if (options.role) {
      if (
        options.role !== 'lord' ||
        !options.community ||
        options.permissions ||
        options.by ||
        options.pending
      )
        throw new Error(
          '--role lord requires only --community; it cannot be mixed with ordinary permissions.',
        )
    } else if (
      typeof options.permissions !== 'string' ||
      ((options.community || options.article) && !options.by)
    ) {
      throw new Error(
        'Ordinary grants require --permissions and --by (the registered manager alias).',
      )
    }
  }
  return { command: area === 'actors' ? `actor.${action}` : 'community.create', options }
}

export const runLocalTestCommand = async (
  args: string[],
  checkHub: () => Promise<unknown>,
  origin: string,
): Promise<unknown> => {
  assertLocalTestTarget(origin)
  const { command, options } = parseLocalTestCommand(args)
  const status = (await checkHub()) as Array<{ id: string; status: string }>
  const app = options.app === 'community' ? 'community' : 'dash'
  const required = command === 'actor.open' ? ['phoenix', 'auth', app] : ['phoenix']
  for (const id of required) {
    if (!status.some((service) => service.id === id && service.status === 'running'))
      throw new Error(`Start ${id} through pnpm devhub start ${id} first.`)
  }
  const state = await prepareLocalEnvironment()
  const call = async (body: Record<string, unknown>): Promise<any> => {
    const result = await fetch('http://127.0.0.1:4001/__local-test/actors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Groupher-Local-Test': localTestActorsSecret(state),
      },
      body: JSON.stringify({ run: options.run, ...body }),
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    })
    if (result.status === 404)
      throw new Error(
        'Development fixture route is unavailable. Restart Phoenix through Dev Hub after updating it.',
      )
    const payload = await result.json()
    if (!result.ok) throw new Error(`Local fixture rejected: ${payload.error || result.status}`)
    return payload.data
  }
  if (command === 'actor.create') {
    const count = options.count === undefined ? 1 : Number(options.count)
    if (!Number.isSafeInteger(count) || count < 1 || count > 30)
      throw new Error('--count must be between 1 and 30.')
    const created = []
    for (let i = 1; i <= count; i++) {
      const name =
        count === 1
          ? options.alias || `actor-${randomBytes(3).toString('hex')}`
          : `${options.alias || 'actor'}-${i}`
      if (!NAME.test(String(name))) throw new Error('Generated alias exceeds 40 characters.')
      created.push(await call({ command, alias: name }))
    }
    return created
  }
  if (command === 'actor.open') {
    const actor = await call({
      command: 'actor.check',
      alias: options.as,
      community: options.community,
      app,
    })
    return openActorBrowser({
      run: String(options.run),
      alias: String(options.as),
      community: String(options.community),
      login: actor.login,
      app,
      headless: options.headless === true,
    })
  }
  if (command === 'actor.close') {
    const result = await call({ command })
    await closeActorBrowsers(String(options.run))
    return result
  }
  if (command === 'actor.clean') {
    const result = await call({ command, apply: options.apply === true })
    if (options.apply === true && result.status === 'cleaned')
      await cleanActorBrowsers(String(options.run))
    else if (options.apply === true && result.status === 'partial')
      await closeActorBrowsers(String(options.run))
    return result
  }
  const body: Record<string, unknown> = { ...options, command, alias: options.as }
  delete body.as
  if (options.permissions !== undefined)
    body.permissions = Object.fromEntries(
      String(options.permissions)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((action) => [action, true]),
    )
  if (command === 'community.create')
    body.slug ||= `lt-${String(options.run).slice(0, 12)}-${randomBytes(3).toString('hex')}`
  return call(body)
}
