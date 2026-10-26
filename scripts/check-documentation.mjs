/**
 * Verifies repository-owned module docs, shared callable docs, and app READMEs.
 *
 * The check deliberately excludes tests, fixtures, generated artifacts, route
 * components, and local salon style factories. Those files either model
 * external inputs, inherit framework contracts, or are not reusable public
 * boundaries.
 *
 *   repository source -> pure documentation analyzers -> collected failures -> CLI exit status
 *                                          |
 *                                          `-> node:test regression fixtures
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { parse } from '@babel/parser'

const root = path.resolve(import.meta.dirname, '..')
const failures = []

const relative = (file) => path.relative(root, file)
const fail = (file, message) => failures.push(`${relative(file)}: ${message}`)

const walk = (directory, accept, skip = () => false) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (skip(file)) return []
    if (entry.isDirectory()) return walk(file, accept, skip)
    return accept(file) ? [file] : []
  })

/** Reports whether documentation contains the minimum syntax for an ASCII handoff or flow. */
export const hasAsciiFlow = (text) => /-->|->|<->|\n\s*(?:\*\s*){0,1}[|+`]--?/.test(text)

/** Masks Elixir comments and string literals while preserving offsets and line breaks. */
const maskElixirCommentsAndStrings = (source) => {
  const masked = source.split('')
  let index = 0

  const blank = (start, end) => {
    for (let cursor = start; cursor < end; cursor += 1) {
      if (masked[cursor] !== '\n' && masked[cursor] !== '\r') masked[cursor] = ' '
    }
  }

  while (index < source.length) {
    if (source[index] === '#') {
      const start = index
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        index += 1
      }
      blank(start, index)
      continue
    }

    const quote = source[index]
    if (quote !== '"' && quote !== "'") {
      index += 1
      continue
    }

    const delimiter = source.slice(index, index + 3) === quote.repeat(3) ? quote.repeat(3) : quote
    const start = index
    index += delimiter.length

    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2
      } else if (source.slice(index, index + delimiter.length) === delimiter) {
        index += delimiter.length
        break
      } else {
        index += 1
      }
    }

    blank(start, Math.min(index, source.length))
  }

  return masked.join('')
}

/** Returns module-documentation violations found in one Elixir source string. */
export const findElixirModuleDocumentationIssues = (source) => {
  const issues = []
  const structuralSource = maskElixirCommentsAndStrings(source)
  const modules = [
    ...structuralSource.matchAll(/^[\t ]*defmodule[\t ]+([^\s]+)[\t ]+do[\t ]*$/gm),
  ]

  for (const [index, module] of modules.entries()) {
    const start = module.index + module[0].length
    const end = modules[index + 1]?.index ?? source.length
    const moduleHeader = source.slice(start, end)
    const structuralHeader = structuralSource.slice(start, end)
    const name = module[1]

    if (/^[\t ]*@moduledoc\s+false/m.test(structuralHeader)) {
      issues.push(`${name} uses @moduledoc false`)
      continue
    }

    const docAttribute = structuralHeader.search(/^[\t ]*@moduledoc\b/m)
    const docSource = docAttribute < 0 ? '' : moduleHeader.slice(docAttribute)
    const heredoc = docSource.match(/^\s*@moduledoc\s+"""([\s\S]*?)"""/)
    const singleLine = docSource.match(/^\s*@moduledoc\s+"([^"\n]*)"/)
    const body = heredoc?.[1] ?? singleLine?.[1]
    if (!body) issues.push(`${name} is missing @moduledoc`)
    else if (!hasAsciiFlow(body))
      issues.push(`${name} module doc is missing an ASCII business-position flow`)
  }

  return issues
}

const checkElixirModules = () => {
  const directory = path.join(root, 'backend/api/lib')
  const files = walk(directory, (file) => file.endsWith('.ex'))

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const issue of findElixirModuleDocumentationIssues(source)) fail(file, issue)
  }
}

const productionSourceSkip = (file) =>
  /(^|\/)(node_modules|dist|\.cloudflare|\.wrangler|coverage|e2e|fixtures|generated|public|__test__)(\/|$)/.test(
    file,
  ) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  /(^|\/)salon(\/|\.[cm]?[jt]sx?$)/.test(file) ||
  /\.d\.[cm]?ts$/.test(file)

const backendApps = ['assets-hub', 'auth', 'content-import', 'press']
const infraApps = ['dev-gateway']

const frontendFlowModules = [
  'frontend/community/src/query/queries.ts',
  'frontend/community/src/server/community.ts',
  'frontend/core/hooks/useArticleState/index.ts',
  'frontend/core/hooks/useArticleStates/index.ts',
  'frontend/core/hooks/useArticleStates/shared.ts',
  'frontend/core/hooks/useTrackArticleView.ts',
  'frontend/core/query/ArticleQueryProvider.tsx',
  'frontend/core/query/articlePath.ts',
  'frontend/core/query/articleStats.ts',
  'frontend/core/query/articleStatsNormalize.ts',
  'frontend/core/query/invalidation/article.ts',
  'frontend/core/query/key.ts',
  'frontend/core/query/mutation/article/collect.ts',
  'frontend/core/query/mutation/article/emotion.ts',
  'frontend/core/query/mutation/article/result.ts',
  'frontend/core/query/mutation/article/upvote.ts',
  'frontend/core/query/mutation/articleReceipt.ts',
  'frontend/core/query/queryClient.ts',
  'frontend/core/query/viewAck.ts',
  'frontend/core/query/viewer.ts',
  'frontend/core/query/viewTracker.ts',
]

const checkFrontendFlowModules = () => {
  for (const relativeFile of frontendFlowModules) {
    const file = path.join(root, relativeFile)
    const source = fs.readFileSync(file, 'utf8')
    const header = source.match(/^\s*\/\*\*([\s\S]*?)\*\//)?.[1]
    if (!header) fail(file, 'is missing a leading JSDoc module comment')
    else if (!hasAsciiFlow(header))
      fail(file, 'module JSDoc is missing an ASCII business-position flow')
  }
}

const checkBackendScriptModules = () => {
  for (const [base, app] of [
    ...backendApps.map((app) => ['backend', app]),
    ...infraApps.map((app) => ['infra', app]),
  ]) {
    const directory = path.join(root, base, app)
    const files = walk(directory, (file) => /\.[cm]?[jt]sx?$/.test(file), productionSourceSkip)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      const header = source.match(/^\s*\/\*\*([\s\S]*?)\*\//)?.[1]
      if (!header) fail(file, 'is missing a leading JSDoc module comment')
      else if (!hasAsciiFlow(header))
        fail(file, 'module JSDoc is missing an ASCII business-position flow')
    }
  }

  const pythonDirectory = path.join(root, 'backend/document-converter')
  const pythonFiles = walk(
    pythonDirectory,
    (file) => file.endsWith('.py'),
    (file) => /(^|\/)(tests|\.venv)(\/|$)/.test(file),
  )
  for (const file of pythonFiles) {
    const source = fs.readFileSync(file, 'utf8')
    const header = source.match(/^\s*"""([\s\S]*?)"""/)?.[1]
    if (!header) fail(file, 'is missing a module docstring')
    else if (!hasAsciiFlow(header))
      fail(file, 'module docstring is missing an ASCII business-position flow')
  }
}

/** Reports whether an AST declaration has an immediately adjacent JSDoc block. */
export const hasAdjacentJsdoc = (node, source) =>
  (node.leadingComments || []).some((comment) => {
    if (comment.type !== 'CommentBlock' || !comment.value.startsWith('*')) return false
    const between = source.slice(comment.end, node.start)
    return /^\s*\n?[ \t]*$/.test(between) && (between.match(/\n/g) || []).length <= 1
  })

/**
 * Parses JavaScript or TypeScript without accepting a partially recovered AST.
 *
 * JSX is opt-in because treating a plain `.ts` generic arrow as TSX produces a false parser error.
 */
export const parseJavaScriptForDocumentation = (source, { jsx = false } = {}) => {
  const ast = parse(source, {
    sourceType: 'unambiguous',
    errorRecovery: true,
    plugins: ['typescript', ...(jsx ? ['jsx'] : []), 'decorators-legacy', 'importAttributes'],
  })

  if (ast.errors.length > 0) {
    throw new SyntaxError(ast.errors.map((error) => error.message).join('; '))
  }

  return ast
}

/** Selects parser features from the source extension rather than from source-content guesses. */
export const javaScriptParserOptionsForFile = (file) => ({
  jsx: /\.[cm]?[jt]sx$/.test(file),
})

/** Returns exported callable names that do not have adjacent purpose-oriented JSDoc. */
export const findExportedCallableDocumentationIssues = (source, options) => {
  const ast = parseJavaScriptForDocumentation(source, options)
  const locals = new Map()
  for (const statement of ast.program.body) {
    if (statement.type === 'FunctionDeclaration' && statement.id) {
      locals.set(statement.id.name, statement)
    }
    if (statement.type === 'VariableDeclaration') {
      for (const item of statement.declarations) {
        if (
          item.id.type === 'Identifier' &&
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(item.init?.type)
        ) {
          locals.set(item.id.name, statement)
        }
      }
    }
  }

  const candidates = []
  for (const statement of ast.program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration
      if (declaration.type === 'FunctionDeclaration' && declaration.id) {
        candidates.push({ name: declaration.id.name, statement })
      }
      continue
    }
    if (statement.type !== 'ExportNamedDeclaration') continue
    const declaration = statement.declaration
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      candidates.push({ name: declaration.id.name, statement })
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) {
        if (
          item.id.type === 'Identifier' &&
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(item.init?.type)
        ) {
          candidates.push({ name: item.id.name, statement })
        }
      }
    }
    if (!declaration && !statement.source) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ExportSpecifier') continue
        const local = locals.get(specifier.local.name)
        if (local) candidates.push({ name: specifier.local.name, statement: local })
      }
    }
  }

  const issues = []
  const checkedStarts = new Set()
  for (const { name, statement } of candidates) {
    if (/^[A-Z]/.test(name) || checkedStarts.has(statement.start)) continue
    checkedStarts.add(statement.start)
    if (!hasAdjacentJsdoc(statement, source)) issues.push(name)
  }
  return issues
}

const checkExportedCallables = () => {
  const sourceRoots = [
    ...['core', 'community', 'dash', 'apply', 'widget', 'landing', 'inspire-me', 'mock-server'].map(
      (app) => path.join(root, 'frontend', app),
    ),
    ...backendApps.map((app) => path.join(root, 'backend', app)),
    ...infraApps.map((app) => path.join(root, 'infra', app)),
    path.join(root, 'packages'),
    path.join(root, 'scripts'),
  ]

  for (const directory of sourceRoots) {
    const files = walk(
      directory,
      (file) => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts'),
      productionSourceSkip,
    )
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      try {
        const options = javaScriptParserOptionsForFile(file)
        for (const name of findExportedCallableDocumentationIssues(source, options)) {
          fail(file, `exported callable ${name} is missing adjacent JSDoc`)
        }
      } catch (error) {
        fail(file, `cannot be parsed for documentation coverage: ${error.message}`)
      }
    }
  }
}

const checkElixirSharedFunctions = () => {
  const deepContextDocFiles = ['activity', 'jobs', 'public_cache', 'request_actor'].flatMap(
    (directory) =>
      walk(
        path.join(root, 'backend/api/lib/groupher_server', directory),
        (file) => file.endsWith('.ex'),
        (file) => /\/model\//.test(file),
      ),
  )

  const contextDocFiles = [
    ...[
      'achievements',
      'collect_folders',
      'config',
      'events',
      'fans',
      'front_desk',
      'mailbox',
      'profiles',
      'publish',
      'search',
      'upvotes',
    ].map((file) => `backend/api/lib/groupher_server/accounts/${file}.ex`),
    ...[
      'analysis.ex',
      'analysis/aggregator.ex',
      'analysis/article_insights.ex',
      'analysis/contribution.ex',
      'analysis/maintenance.ex',
      'analysis/web.ex',
      'activity.ex',
      'jobs.ex',
      'messaging.ex',
      'messaging/inbox.ex',
      'messaging/notify.ex',
      'public_cache.ex',
      'request_actor.ex',
    ].map((file) => `backend/api/lib/groupher_server/${file}`),
    ...[
      'accounts/mailbox/query.ex',
      'accounts/mailbox/projection.ex',
      'accounts/mailbox/effects.ex',
      'accounts/mailbox/workflow.ex',
      'accounts/collect_folders/persist.ex',
      'accounts/collect_folders/commands/create.ex',
      'accounts/collect_folders/commands/update.ex',
      'accounts/collect_folders/commands/delete.ex',
      'accounts/collect_folders/commands/add.ex',
      'accounts/collect_folders/commands/remove.ex',
      'accounts/fans/persist.ex',
      'accounts/fans/effects.ex',
      'accounts/fans/list.ex',
      'accounts/fans/viewer_state.ex',
      'accounts/fans/commands/follow.ex',
      'accounts/fans/commands/unfollow.ex',
      'accounts/profiles/query.ex',
      'accounts/profiles/list.ex',
      'accounts/profiles/oauth.ex',
      'accounts/profiles/browser_sessions.ex',
      'accounts/profiles/oauth/persist.ex',
      'accounts/profiles/persist.ex',
      'accounts/profiles/effects.ex',
      'accounts/profiles/projection.ex',
      'accounts/profiles/projection/contributions.ex',
      'accounts/profiles/commands/update_profile.ex',
      'accounts/profiles/commands/update_subscribe_state.ex',
      'accounts/profiles/commands/link_oauth.ex',
      'accounts/profiles/commands/unlink_oauth.ex',
      'accounts/profiles/commands/sign_in_oauth.ex',
      'accounts/profiles/commands/link_oauth_identity.ex',
      'accounts/profiles/commands/unlink_oauth_identity.ex',
      'accounts/achievements/persist.ex',
      'accounts/achievements/commands/achieve.ex',
      'accounts/publish/persist.ex',
      'accounts/publish/effects.ex',
      'accounts/publish/projection.ex',
      'accounts/publish/articles.ex',
      'accounts/publish/comments.ex',
      'accounts/search/user.ex',
      'accounts/collect_folders/articles.ex',
      'accounts/events/notify.ex',
      'analysis/contribution/persist.ex',
      'analysis/contribution/query.ex',
      'analysis/contribution/effects.ex',
      'analysis/contribution/workflow.ex',
      'analysis/aggregator/persist.ex',
      'analysis/aggregator/workflow.ex',
      'analysis/maintenance/query.ex',
      'analysis/maintenance/persist.ex',
      'analysis/maintenance/workflow.ex',
      'analysis/metric_event/persist.ex',
      'analysis/web/provision.ex',
      'messaging/mentions/query.ex',
      'messaging/mentions/persist.ex',
      'messaging/notifications/query.ex',
      'messaging/notifications/persist.ex',
      'messaging/commands/send_mention.ex',
      'messaging/commands/send_notification.ex',
      'messaging/commands/revoke_notification.ex',
      'messaging/commands/mark_read.ex',
      'messaging/commands/mark_read_all.ex',
      'messaging/inbox/persist.ex',
    ].map((file) => `backend/api/lib/groupher_server/${file}`),
    ...deepContextDocFiles.map((file) => relative(file)),
    'backend/api/lib/groupher_server/cms/interactions/persist.ex',
    'backend/api/lib/groupher_server/cms/dashboard/persist.ex',
  ].map((file) => path.join(root, file))

  const boundaryFiles = [
    'backend/api/lib/groupher_server/front_desk.ex',
    'backend/api/lib/groupher_server/cms/front_desk.ex',
    'backend/api/lib/groupher_server/cms/front_desk/article.ex',
    'backend/api/lib/groupher_server/cms/front_desk/comment.ex',
    'backend/api/lib/groupher_server/cms/gate.ex',
    'backend/api/lib/groupher_server/cms/communities/lifecycle.ex',
    'backend/api/lib/groupher_server/cms/docs/lifecycle.ex',
    'backend/api/lib/groupher_server/cms/passport/authorization.ex',
    'backend/api/lib/groupher_server/cms/passport/registry.ex',
    'backend/api/lib/groupher_server/cms/outbox/workflow.ex',
    ...walk(path.join(root, 'backend/api/lib/groupher_server/cms/outbox/workflow'), (file) =>
      file.endsWith('.ex'),
    ).map((file) => relative(file)),
    'backend/api/lib/groupher_server/cms/command/confirmation_definition.ex',
    'backend/api/lib/groupher_server/cms/articles/query.ex',
    'backend/api/lib/groupher_server/error_cat/workflow.ex',
    'backend/api/lib/groupher_server/error_cat/validator.ex',
    'backend/api/lib/groupher_server/command_pipeline.ex',
    'backend/api/lib/groupher_server/command_pipeline/rejected.ex',
    'backend/api/lib/groupher_server/cms/comments/query.ex',
    'backend/api/lib/groupher_server/cms/comments/persist.ex',
    'backend/api/lib/groupher_server/cms/comments/lifecycle.ex',
    'backend/api/lib/groupher_server/cms/comments/interaction_response.ex',
    'backend/api/lib/groupher_server/cms/articles/response.ex',
    'backend/api/lib/groupher_server/cms/articles/mutation_lock.ex',
    'backend/api/lib/groupher_server/cms/gate/access.ex',
    ...walk(path.join(root, 'backend/api/lib/groupher_server/cms/gate/access'), (file) =>
      file.endsWith('.ex'),
    ).map((file) => relative(file)),
    'backend/api/lib/groupher_server/cms/model/post_solution.ex',
    'backend/api/lib/groupher_server/cms/comments/solution.ex',
    'backend/api/lib/groupher_server/cms/comments/commands/update.ex',
    'backend/api/lib/groupher_server/cms/comments/commands/delete.ex',
    'backend/api/lib/groupher_server/cms/article_stats.ex',
    'backend/api/lib/groupher_server/cms/front_desk/article.ex',
    'backend/api/lib/groupher_server/cms/interactions/projection.ex',
    'backend/api/lib/groupher_server/cms/interactions/projection/query.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/anonymous_session.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/config.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/identity.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/policy.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/query.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/record.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/view_counter.ex',
    'backend/api/lib/groupher_server/cms/view_tracker/view_dedupe_cleanup.ex',
    'backend/api/lib/groupher_server/request_actor/evidence.ex',
  ].map((file) => path.join(root, file))

  const files = [
    ...walk(path.join(root, 'backend/api/lib/helper'), (file) => file.endsWith('.ex')),
    ...['accounts', 'cms', 'messaging', 'analysis'].flatMap((context) => {
      const directory = path.join(root, 'backend/api/lib/groupher_server', context)
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ex'))
        .map((entry) => path.join(directory, entry.name))
    }),
    ...['messaging', 'analysis', 'jobs', 'activity', 'front_desk'].map((context) =>
      path.join(root, 'backend/api/lib/groupher_server', `${context}.ex`),
    ),
    ...contextDocFiles,
    ...boundaryFiles,
  ].filter((file, index, all) => all.indexOf(file) === index)

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const strictArity = boundaryFiles.includes(file) || contextDocFiles.includes(file)
    const seen = new Set()
    let previousDefinition = -1
    lines.forEach((line, index) => {
      const match = line.match(/^  def(?:macro|guard|delegate)?\s+([a-zA-Z_][a-zA-Z0-9_!?]*)/)
      if (!match) return
      const name = match[1]
      const arity = elixirDefinitionArity(lines, index, name)
      const identity = strictArity ? `${name}/${arity}` : name
      const prior = lines.slice(previousDefinition + 1, index).join('\n')
      previousDefinition = index
      if (seen.has(identity)) return
      seen.add(identity)
      const hasHiddenDoc = /^(?: {2}|\t)@doc[\t ]+false\b/m.test(prior)
      const acceptsHiddenDoc = contextDocFiles.includes(file) && hasHiddenDoc
      const hasAdjacentDoc = /^(?: {2}|\t)@(doc|impl)\b/m.test(prior)
      if (!hasAdjacentDoc || (hasHiddenDoc && !acceptsHiddenDoc)) {
        const label = strictArity ? identity : name
        fail(file, `shared public function ${label} is missing @doc or inherited @impl docs`)
      } else if (
        !acceptsHiddenDoc &&
        contextDocFiles.includes(file) &&
        !/## Examples|@example/.test(prior)
      ) {
        fail(file, `context public function ${identity} is missing a real ## Examples section`)
      }
    })
  }
}

/**
 * Derives the declared arity of one Elixir definition from its possibly multiline signature.
 *
 * Commas nested inside maps, lists, tuples, or strings are ignored. Default arguments retain the
 * arity written in the source because the documentation audit identifies the shared declaration.
 */
export const elixirDefinitionArity = (lines, start, name) => {
  let signature = lines[start]
  for (let index = start + 1; index < lines.length && index <= start + 30; index += 1) {
    if (/\bdo\b|,\s*do:/.test(signature)) break
    signature += `\n${lines[index]}`
  }

  const nameIndex = signature.indexOf(name)
  const openIndex = signature.indexOf('(', nameIndex + name.length)
  if (openIndex === -1) return 0

  let depth = 0
  let closingIndex = -1
  let quote = null
  for (let index = openIndex; index < signature.length; index += 1) {
    const char = signature[index]
    const previous = signature[index - 1]
    if (quote) {
      if (char === quote && previous !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if ('([{'.includes(char)) depth += 1
    if (')]}'.includes(char)) depth -= 1
    if (depth === 0) {
      closingIndex = index
      break
    }
  }

  if (closingIndex === -1) return 'unknown'
  const args = signature.slice(openIndex + 1, closingIndex).trim()
  if (args === '') return 0

  let arity = 1
  depth = 0
  quote = null
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index]
    const previous = args[index - 1]
    if (quote) {
      if (char === quote && previous !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if ('([{'.includes(char)) depth += 1
    if (')]}'.includes(char)) depth -= 1
    if (char === ',' && depth === 0) arity += 1
  }
  return arity
}

const checkWorkspaceReadmes = () => {
  const directories = []
  for (const parent of ['backend', 'frontend', 'local', 'packages']) {
    const parentDirectory = path.join(root, parent)
    for (const entry of fs.readdirSync(parentDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const directory = path.join(parentDirectory, entry.name)
      if (fs.existsSync(path.join(directory, 'package.json'))) directories.push(directory)
    }
  }
  directories.push(path.join(root, 'backend/api'), path.join(root, 'backend/document-converter'))

  for (const directory of directories) {
    if (!fs.existsSync(path.join(directory, 'README.md'))) fail(directory, 'is missing README.md')
  }
}

const documentationStatuses = new Set([
  'current',
  'in-progress',
  'planned',
  'superseded',
  'historical',
])

const maskMarkdownCode = (source) => {
  const lines = source.split('\n')
  let fence = null

  const masked = lines.map((line) => {
    const match = line.match(/^( {0,3})(`{3,}|~{3,})/i)
    const marker = match?.[2]
    const markerEnd = (match?.[1].length ?? 0) + (marker?.length ?? 0)

    if (!fence && marker) {
      fence = { character: marker[0], length: marker.length }
      return ' '.repeat(line.length)
    }

    if (fence) {
      if (
        marker &&
        marker[0] === fence.character &&
        marker.length >= fence.length &&
        line.slice(markerEnd).trim() === ''
      ) {
        fence = null
      }
      return ' '.repeat(line.length)
    }

    return line.replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length))
  })

  return masked.join('\n')
}

const markdownLinkDestination = (source, start) => {
  let cursor = start
  while (/\s/.test(source[cursor] ?? '') && source[cursor] !== '\n') cursor += 1

  if (source[cursor] === '<') {
    const end = source.indexOf('>', cursor + 1)
    return end === -1 ? null : source.slice(cursor + 1, end)
  }

  const targetStart = cursor
  let depth = 0
  let escaped = false
  for (; cursor < source.length; cursor += 1) {
    const current = source[cursor]
    if (escaped) {
      escaped = false
      continue
    }
    if (current === '\\') {
      escaped = true
      continue
    }
    if (current === '(') {
      depth += 1
      continue
    }
    if (current === ')') {
      if (depth === 0) break
      depth -= 1
      continue
    }
    if (/\s/.test(current) && depth === 0) break
  }

  return source.slice(targetStart, cursor)
}

/** Returns invalid repository-local Markdown links with their source line. */
export const findMarkdownLocalLinkIssues = (source, sourceFile, exists = fs.existsSync) => {
  const masked = maskMarkdownCode(source)
  const issues = []

  for (const match of masked.matchAll(/\[[^\]\n]+\]\(/g)) {
    const rawTarget = markdownLinkDestination(masked, match.index + match[0].length)
    if (rawTarget === null) continue
    const target = rawTarget.split('#')[0]
    if (
      target === '' ||
      target.startsWith('#') ||
      target.startsWith('/') ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)
    ) {
      continue
    }

    let decoded
    try {
      decoded = decodeURIComponent(target)
    } catch {
      decoded = target
    }

    if (!exists(path.resolve(path.dirname(sourceFile), decoded))) {
      const line = source.slice(0, match.index).split('\n').length
      issues.push(`line ${line} links to missing path ${rawTarget}`)
    }
  }

  return issues
}

/** Returns a README status issue unless it uses the repository's fixed vocabulary. */
export const findDocumentationReadmeStatusIssue = (source) => {
  const status = source.match(/^> 状态：([^\n]+)$/m)?.[1].trim()
  if (!status) return 'is missing a standard status'
  if (!documentationStatuses.has(status)) {
    return `uses non-standard status ${status}`
  }
  return null
}

const documentationAppDirectories = [
  'ai',
  'apply',
  'assets-hub',
  'auth',
  'community',
  'content-import',
  'dash',
  'document-converter',
  'gateway',
  'posthouse',
  'press',
  'risk-center',
  'umami',
  'widget',
]

const checkDocumentationStructure = () => {
  const docsDirectory = path.join(root, 'docs')
  const markdownFiles = walk(docsDirectory, (file) => file.endsWith('.md'))

  for (const file of markdownFiles) {
    const source = fs.readFileSync(file, 'utf8')
    for (const issue of findMarkdownLocalLinkIssues(source, file)) fail(file, issue)

    if (path.basename(file) === 'README.md') {
      const issue = findDocumentationReadmeStatusIssue(source)
      if (issue) fail(file, issue)
    }
  }

  for (const app of documentationAppDirectories) {
    const directory = path.join(docsDirectory, app)
    if (!fs.existsSync(path.join(directory, 'README.md'))) {
      fail(directory, 'documentation application directory is missing README.md')
    }
  }
}

/** Runs the repository documentation audit and returns stable, user-facing failure descriptions. */
export const runDocumentationCheck = () => {
  failures.length = 0
  checkElixirModules()
  checkBackendScriptModules()
  checkFrontendFlowModules()
  checkExportedCallables()
  checkElixirSharedFunctions()
  checkWorkspaceReadmes()
  checkDocumentationStructure()
  return [...failures]
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  const results = runDocumentationCheck()
  if (results.length > 0) {
    console.error(`Documentation coverage failed with ${results.length} issue(s):`)
    for (const failure of results) console.error(`- ${failure}`)
    process.exitCode = 1
  } else {
    console.log('Documentation coverage passed.')
  }
}
