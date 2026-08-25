/**
 * Verifies repository-owned module docs, shared callable docs, and app READMEs.
 *
 * The check deliberately excludes tests, generated artifacts, route components,
 * and local salon style factories. Those files either inherit framework
 * contracts or are not reusable public boundaries.
 */

import fs from 'node:fs'
import path from 'node:path'

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

const hasAsciiFlow = (text) => /-->|->|<->|\n\s*(?:\*\s*){0,1}[|+`]--?/.test(text)

const checkElixirModules = () => {
  const directory = path.join(root, 'backend/main/lib')
  const files = walk(directory, (file) => file.endsWith('.ex'))

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const modules = [...source.matchAll(/^\s*defmodule\s+([^\s]+)\s+do\s*$/gm)]

    for (const [index, module] of modules.entries()) {
      const start = module.index + module[0].length
      const end = modules[index + 1]?.index ?? source.length
      const moduleHeader = source.slice(start, end)
      const name = module[1]

      if (/^\s*@moduledoc\s+false/m.test(moduleHeader)) {
        fail(file, `${name} uses @moduledoc false`)
        continue
      }

      const heredoc = moduleHeader.match(/@moduledoc\s+"""([\s\S]*?)"""/)
      const singleLine = moduleHeader.match(/@moduledoc\s+"([^"\n]*)"/)
      const body = heredoc?.[1] ?? singleLine?.[1]
      if (!body) fail(file, `${name} is missing @moduledoc`)
      else if (!hasAsciiFlow(body))
        fail(file, `${name} module doc is missing an ASCII business-position flow`)
    }
  }
}

const productionSourceSkip = (file) =>
  /(^|\/)(node_modules|dist|\.next|\.wrangler|coverage|e2e|generated|public|__test__)(\/|$)/.test(
    file,
  ) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  /(^|\/)salon(\/|\.[cm]?[jt]sx?$)/.test(file) ||
  /(?:next-env|cloudflare-workers)\.d\.ts$/.test(file)

const backendApps = ['assets-hub', 'auth', 'content-import', 'inspire-me', 'press']
const infraApps = ['gateway']

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

const hasAdjacentJsdoc = (node, source) =>
  (node.leadingComments || []).some((comment) => {
    if (comment.type !== 'CommentBlock' || !comment.value.startsWith('*')) return false
    const between = source.slice(comment.end, node.start)
    return /^\s*\n?[ \t]*$/.test(between) && (between.match(/\n/g) || []).length <= 1
  })

const checkExportedCallables = () => {
  const sourceRoots = [
    ...['core', 'main', 'dashboard', 'dash', 'apply', 'widget', 'landing', 'mock-server'].map(
      (app) => path.join(root, 'frontend', app),
    ),
    ...backendApps.map((app) => path.join(root, 'backend', app)),
    ...infraApps.map((app) => path.join(root, 'infra', app)),
    path.join(root, 'packages'),
  ]

  for (const directory of sourceRoots) {
    const files = walk(
      directory,
      (file) => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts'),
      productionSourceSkip,
    )
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      let ast
      try {
        ast = parse(source, {
          sourceType: 'unambiguous',
          errorRecovery: true,
          plugins: ['typescript', 'jsx', 'decorators-legacy', 'importAttributes'],
        })
      } catch (error) {
        fail(file, `cannot be parsed for documentation coverage: ${error.message}`)
        continue
      }

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

      const checkedStarts = new Set()
      for (const { name, statement } of candidates) {
        if (/^[A-Z]/.test(name) || checkedStarts.has(statement.start)) continue
        checkedStarts.add(statement.start)
        if (!hasAdjacentJsdoc(statement, source)) {
          fail(file, `exported callable ${name} is missing adjacent JSDoc`)
        }
      }
    }
  }
}

const checkElixirSharedFunctions = () => {
  const boundaryFiles = [
    'backend/main/lib/groupher_server/cms/comments/list.ex',
    'backend/main/lib/groupher_server/cms/comments/writer.ex',
    'backend/main/lib/groupher_server/cms/comments/lifecycle.ex',
    'backend/main/lib/groupher_server/cms/comments/job_policy.ex',
    'backend/main/lib/groupher_server/cms/comments/interaction_response.ex',
    'backend/main/lib/groupher_server/cms/articles/interaction_response.ex',
    'backend/main/lib/groupher_server/cms/articles/mutation_lock.ex',
    'backend/main/lib/groupher_server/cms/gate/access.ex',
    'backend/main/lib/groupher_server/cms/gate/access/check.ex',
    'backend/main/lib/groupher_server/cms/model/post_solution.ex',
    'backend/main/lib/groupher_server/cms/comments/commands/accept_solution.ex',
    'backend/main/lib/groupher_server/cms/comments/commands/revoke_solution.ex',
    'backend/main/lib/groupher_server/cms/comments/commands/update_comment.ex',
    'backend/main/lib/groupher_server/cms/comments/commands/delete_comment.ex',
    'backend/main/lib/groupher_server/cms/comments/commands/solution_transition.ex',
  ].map((file) => path.join(root, file))

  const files = [
    ...walk(path.join(root, 'backend/main/lib/helper'), (file) => file.endsWith('.ex')),
    ...['accounts', 'cms', 'messaging', 'analysis'].flatMap((context) => {
      const directory = path.join(root, 'backend/main/lib/groupher_server', context)
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ex'))
        .map((entry) => path.join(directory, entry.name))
    }),
    ...['messaging', 'analysis', 'jobs', 'activity', 'front_desk'].map((context) =>
      path.join(root, 'backend/main/lib/groupher_server', `${context}.ex`),
    ),
    ...boundaryFiles,
  ].filter((file, index, all) => all.indexOf(file) === index)

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const strictArity = boundaryFiles.includes(file)
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
      if (!/^\s*@(doc|impl)\b/m.test(prior) || /^\s*@doc\s+false/m.test(prior)) {
        const label = strictArity ? identity : name
        fail(file, `shared public function ${label} is missing @doc or inherited @impl docs`)
      }
    })
  }
}

const elixirDefinitionArity = (lines, start, name) => {
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
  directories.push(path.join(root, 'backend/main'), path.join(root, 'backend/document-converter'))

  for (const directory of directories) {
    if (!fs.existsSync(path.join(directory, 'README.md'))) fail(directory, 'is missing README.md')
  }
}

checkElixirModules()
checkBackendScriptModules()
checkExportedCallables()
checkElixirSharedFunctions()
checkWorkspaceReadmes()

if (failures.length > 0) {
  console.error(`Documentation coverage failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Documentation coverage passed.')
}
