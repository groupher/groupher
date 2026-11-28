/** Local fixture CLI. No target URL, database override or force option is accepted. */
import { randomBytes, randomUUID } from 'node:crypto'

import { localTestActorsSecret, prepareLocalEnvironment } from './local-environment.ts'
import { beginArticleDispatch, createLocalArticle } from './local-test-article.ts'
import {
  cleanActorBrowsers,
  closeActorBrowsers,
  openActorBrowser,
  operateActorBrowser,
  validateActorUIOperation,
  type TActorUIKey,
  type TActorUIOperation,
  type TActorUIRole,
} from './local-test-browser.ts'
import { articleDispatchError, LocalFixtureError } from './local-test-error.ts'

type TOptions = Record<string, string | boolean>
const NAME = /^[a-z][a-z0-9-]{0,39}$/
const USAGE =
  'Usage: pnpm devhub actors create|list|grant|open|ui|close|clean|browsers-clean --run <name> ... | communities create --run <name> --owner <alias> [--slug <slug>] | articles create --run <name> --as <alias> --community <slug> --thread post [--key <key>] [--publish]'

const UI_OPERATIONS = ['snapshot', 'navigate', 'click', 'fill', 'press', 'assert-text'] as const
const UI_ROLES = [
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'menuitem',
  'tab',
] as const
const UI_KEYS = [
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

export const parseActorUIOperation = (op: string, options: TOptions): TActorUIOperation => {
  const common = new Set(['run', 'as', 'community', 'app', 'op'])
  const fieldsByOperation: Record<string, string[]> = {
    snapshot: [],
    navigate: ['path'],
    click: ['role', 'name'],
    fill: ['role', 'name', 'value'],
    press: ['key'],
    'assert-text': ['text'],
  }
  const allowedFields = fieldsByOperation[op]
  if (!allowedFields)
    throw new Error(`Unsupported actor UI operation. Allowed: ${UI_OPERATIONS.join(', ')}.`)
  const unexpected = Object.keys(options).filter(
    (key) => !common.has(key) && !allowedFields.includes(key),
  )
  if (unexpected.length > 0) throw new Error(`Unexpected UI option: --${unexpected[0]}.`)

  let operation: TActorUIOperation
  if (op === 'snapshot') {
    operation = { op }
  } else if (op === 'navigate') {
    if (typeof options.path !== 'string') throw new Error('UI navigate requires --path.')
    operation = { op, path: options.path }
  } else if (op === 'click') {
    if (typeof options.role !== 'string' || typeof options.name !== 'string')
      throw new Error('UI click requires --role and --name.')
    operation = { op, role: options.role as TActorUIRole, name: options.name }
  } else if (op === 'fill') {
    if (
      typeof options.role !== 'string' ||
      typeof options.name !== 'string' ||
      typeof options.value !== 'string'
    )
      throw new Error('UI fill requires --role, --name and --value.')
    operation = {
      op,
      role: options.role as 'textbox' | 'combobox',
      name: options.name,
      value: options.value,
    }
  } else if (op === 'press') {
    if (typeof options.key !== 'string') throw new Error('UI press requires --key.')
    operation = { op, key: options.key as TActorUIKey }
  } else if (op === 'assert-text') {
    if (typeof options.text !== 'string') throw new Error('UI assert-text requires --text.')
    operation = { op, text: options.text }
  } else {
    throw new Error(`Unsupported actor UI operation. Allowed: ${UI_OPERATIONS.join(', ')}.`)
  }
  validateActorUIOperation(operation)
  return operation
}

export const runCheckedActorUI = async (
  input: {
    run: string
    alias: string
    community: string
    app: 'dash' | 'community'
    operation: TActorUIOperation
    publicRoot?: string
  },
  call: (body: Record<string, unknown>) => Promise<any>,
  operate: typeof operateActorBrowser = operateActorBrowser,
) => {
  const actor = await call({
    command: 'actor.check',
    alias: input.alias,
    community: input.community,
    app: input.app,
  })
  return operate(
    {
      run: input.run,
      alias: input.alias,
      community: input.community,
      login: String(actor.login),
      app: input.app,
      headless: false,
      ...(input.publicRoot ? { publicRoot: input.publicRoot } : {}),
    },
    input.operation,
  )
}

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
    'actors.ui': [
      'run',
      'as',
      'community',
      'app',
      'op',
      'path',
      'role',
      'name',
      'value',
      'key',
      'text',
    ],
    'actors.close': ['run'],
    'actors.clean': ['run', 'apply', 'retain-unconfirmed', 'reason'],
    'actors.browsers-clean': ['run'],
    'communities.create': ['run', 'owner', 'slug', 'title'],
    'communities.request-destroy': ['run', 'by', 'slug'],
    'admin.invite': ['run', 'community', 'by', 'to', 'key', 'permissions'],
    'admin.accept': ['run', 'invite', 'as'],
    'admin.set-permissions': ['run', 'community', 'by', 'member', 'key', 'permissions', 'revision'],
    'admin.remove': ['run', 'community', 'by', 'member', 'key', 'revision'],
    'case.theme-edit-permission': ['run', 'community'],
    'case.admin-invitation-pending': ['run', 'community'],
    'case.admin-invitation-accepted': ['run', 'community'],
    'articles.create': ['run', 'as', 'community', 'thread', 'key', 'title', 'markdown', 'publish'],
    'home.prepare': ['run'],
  }
  const allowed = commands[`${area}.${action}`]
  if (!allowed) throw new Error(USAGE)
  const options: TOptions = {}
  for (let i = 0; i < flags.length; i++) {
    const key = flags[i]?.slice(2)
    if (!flags[i]?.startsWith('--') || !allowed.includes(key) || Object.hasOwn(options, key))
      throw new Error(USAGE)
    if (key === 'pending' || key === 'headless' || key === 'apply' || key === 'publish')
      options[key] = true
    else {
      const value = flags[++i]
      if (value === undefined || value.startsWith('--')) throw new Error(USAGE)
      options[key] = value
    }
  }
  if (typeof options.run !== 'string' || !NAME.test(options.run))
    throw new Error('A valid --run is required (lowercase letters, digits and hyphens; max 40).')
  if (action === 'clean' && (options['retain-unconfirmed'] || options.reason)) {
    if (
      options.apply !== true ||
      typeof options['retain-unconfirmed'] !== 'string' ||
      typeof options.reason !== 'string' ||
      !options.reason.trim() ||
      Buffer.byteLength(options.reason) > 1000
    )
      throw new Error(
        '--retain-unconfirmed requires --apply and a nonempty --reason (max 1000 bytes).',
      )
  }
  for (const key of ['as', 'alias', 'owner', 'by', 'to', 'member']) {
    if (
      options[key] !== undefined &&
      (typeof options[key] !== 'string' || !NAME.test(options[key] as string))
    )
      throw new Error(`Invalid --${key}.`)
  }
  if (['grant', 'open', 'ui'].includes(action) && !options.as) throw new Error('--as is required.')
  if (['open', 'ui'].includes(action) && !options.community)
    throw new Error('--community is required for Dash.')
  if (['open', 'ui'].includes(action) && !options.app && action === 'ui')
    throw new Error('--app is required for actors ui.')
  if (options.app && !['dash', 'community'].includes(String(options.app)))
    throw new Error('--app must be dash or community.')
  if (action === 'ui') {
    if (typeof options.op !== 'string') throw new Error('--op is required for actors ui.')
    if (options.role && !UI_ROLES.includes(options.role as (typeof UI_ROLES)[number]))
      throw new Error('--role must be an allowed accessible role.')
    if (options.key && !UI_KEYS.includes(options.key as (typeof UI_KEYS)[number]))
      throw new Error('--key is not allowed.')
    parseActorUIOperation(options.op, options)
  }
  if (area === 'communities' && action === 'create' && !options.owner)
    throw new Error('--owner is required.')
  if (area === 'communities' && action === 'request-destroy' && (!options.by || !options.slug))
    throw new Error('--by and --slug are required.')
  if (area === 'case' && !options.community) throw new Error('--community is required.')
  if (
    area === 'admin' &&
    action === 'invite' &&
    (!options.community || !options.by || !options.to || !options.key || !options.permissions)
  )
    throw new Error('--community, --by, --to, --key and --permissions are required.')
  if (area === 'admin' && action === 'invite' && !NAME.test(String(options.key)))
    throw new Error('Invalid --key.')
  if (
    area === 'admin' &&
    action === 'accept' &&
    (!options.as || !options.invite || !NAME.test(String(options.invite)))
  )
    throw new Error('--as and a valid --invite are required.')
  if (area === 'admin' && ['set-permissions', 'remove'].includes(action)) {
    if (
      !options.community ||
      !options.by ||
      !options.member ||
      !options.key ||
      !NAME.test(String(options.key))
    )
      throw new Error('--community, --by, --member and a valid --key are required.')
    if (action === 'set-permissions' && !options.permissions)
      throw new Error('--permissions is required.')
    if (
      options.revision &&
      (!/^[1-9]\d*$/.test(String(options.revision)) ||
        !Number.isSafeInteger(Number(options.revision)))
    )
      throw new Error('--revision must be a positive integer.')
  }
  if (area === 'articles') {
    if (!options.as || !options.community)
      throw new Error('--as and --community are required for Article fixtures.')
    if (options.thread !== 'post')
      throw new Error('Article fixtures currently require --thread post.')
    if (options.key && !NAME.test(String(options.key))) throw new Error('Invalid --key.')
  }
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
  return {
    command:
      area === 'case'
        ? `case.${action}`
        : area === 'home'
          ? 'home.prepare'
          : area === 'admin'
            ? `admin.${action}`
            : area === 'actors'
              ? `actor.${action}`
              : area === 'articles'
                ? 'article.create'
                : `community.${action}`,
    options,
  }
}

/** Resolve Phoenix from this Hub's snapshot without permitting a remote fixture destination. */
export const localFixtureEndpoint = (services: Array<{ id: string; localUrl?: string | null }>) => {
  const phoenix = services.find((service) => service.id === 'phoenix')
  if (!phoenix?.localUrl) throw new Error('The current Hub did not provide a Phoenix endpoint.')
  const url = new URL(phoenix.localUrl)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port)
    throw new Error('The Phoenix fixture endpoint must be an explicit loopback address.')
  return new URL('/__local-test/actors', url).toString()
}

/** Read the exact sibling domain assigned by the current Hub to Auth and the app. */
export const localPublicRoot = (
  services: Array<{ id: string; url?: string | null }>,
  app: 'dash' | 'community',
) => {
  const authUrl = services.find((service) => service.id === 'auth')?.url
  const appUrl = services.find((service) => service.id === app)?.url
  if (!authUrl || !appUrl) throw new Error('The current Hub did not provide local browser URLs.')
  const auth = new URL(authUrl)
  const appOrigin = new URL(appUrl)
  const root = auth.hostname.startsWith('auth.') ? auth.hostname.slice(5) : ''
  if (
    auth.protocol !== 'https:' ||
    appOrigin.protocol !== 'https:' ||
    auth.port ||
    appOrigin.port ||
    !/^groupher(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\.localhost$/.test(root) ||
    appOrigin.hostname !== `${app}.${root}`
  )
    throw new Error('Browser URLs do not belong to one local environment.')
  return root
}

export const runLocalTestCommand = async (
  args: string[],
  checkHub: () => Promise<unknown>,
  origin: string,
): Promise<unknown> => {
  assertLocalTestTarget(origin)
  const { command, options } = parseLocalTestCommand(args)
  const status = (await checkHub()) as Array<{
    id: string
    status: string
    url?: string | null
    localUrl?: string | null
  }>
  if (command === 'actor.browsers-clean') {
    await cleanActorBrowsers(String(options.run))
    return { cleaned: true }
  }
  const app = options.app === 'community' ? 'community' : 'dash'
  const required =
    command === 'home.prepare'
      ? ['phoenix', 'auth', 'assets-hub']
      : command === 'article.create'
        ? ['phoenix', 'auth', 'dash']
        : command === 'actor.open'
          ? ['phoenix', 'auth', app]
          : command === 'actor.ui'
            ? ['phoenix', app]
            : ['phoenix']
  for (const id of required) {
    if (!status.some((service) => service.id === id && service.status === 'running'))
      throw new Error(`Start ${id} through pnpm devhub start ${id} first.`)
  }
  const state = await prepareLocalEnvironment()
  const call = async (body: Record<string, unknown>): Promise<any> => {
    const result = await fetch(localFixtureEndpoint(status), {
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
    if (!result.ok) {
      const code = typeof payload.error === 'string' ? payload.error : String(result.status)
      const details =
        payload.details && typeof payload.details === 'object' && !Array.isArray(payload.details)
          ? payload.details
          : undefined
      const recoveryCode = [
        'local_test_article_recovery_required',
        'local_test_article_pending',
        'local_test_terminal_evidence_unavailable',
      ].includes(code)
      throw new LocalFixtureError(code, recoveryCode ? { ...details, run: options.run } : details)
    }
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
  if (command === 'article.create') {
    const publicRoot = localPublicRoot(status, 'dash')
    const input = { ...options, alias: options.as }
    const prepared = await call({ ...input, command: 'article.prepare', protocol: 2 })
    if (prepared.existing) return prepared.existing
    const attemptId = randomUUID()
    let dispatchAttempted = false
    try {
      let recorded: unknown
      await createLocalArticle(
        {
          run: String(options.run),
          alias: String(options.as),
          community: String(options.community),
          publicRoot,
        },
        prepared,
        async () => {
          dispatchAttempted = true
          await beginArticleDispatch(call, {
            ...input,
            command: 'article.begin',
            commandId: prepared.command.commandId,
            attemptId,
          })
        },
        undefined,
        async (created) => {
          recorded = await call({ ...input, ...created, command: 'article.record' })
        },
      )
      return recorded
    } catch (error) {
      throw articleDispatchError(error, options.run, dispatchAttempted)
    }
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
      publicRoot: localPublicRoot(status, app),
    })
  }
  if (command === 'actor.ui') {
    const operation = parseActorUIOperation(String(options.op), options)
    return runCheckedActorUI(
      {
        run: String(options.run),
        alias: String(options.as),
        community: String(options.community),
        app,
        operation,
        publicRoot: localPublicRoot(status, app),
      },
      call,
    )
  }
  if (command === 'actor.close') {
    const result = await call({ command })
    await cleanActorBrowsers(String(options.run))
    return result
  }
  if (command === 'actor.clean') {
    const result = await call({
      command,
      apply: options.apply === true,
      ...(options['retain-unconfirmed']
        ? { 'retain-unconfirmed': options['retain-unconfirmed'], reason: options.reason }
        : {}),
    })
    if (options.apply === true && result.status === 'cleaned')
      await cleanActorBrowsers(String(options.run))
    else if (options.apply === true && result.status === 'partial')
      await closeActorBrowsers(String(options.run))
    return result
  }
  const body: Record<string, unknown> = { ...options, command, alias: options.as }
  if (options.revision !== undefined) body.revision = Number(options.revision)
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
