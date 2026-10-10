#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePattern = /\.(?:ts|tsx|js|jsx|ex|exs)$/
const cmsRoot = 'backend/api/lib/groupher_server/cms/'
const persistFilePattern = /(?:^|\/)(?:persist|[^/]+_persist)\.ex$/

/**
 * CMS command boundary gate:
 *
 *   repository files
 *     -> command identity owner
 *     -> Persist / resolver / facade boundaries
 *     -> clean or actionable violation list
 */

/** Lists tracked and non-ignored working-tree source files for the command gate.
 * @example
 * repositoryFiles().some((file) => file.endsWith('binding_persist.ex'))
 */
export const repositoryFiles = () =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'frontend', 'backend'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((file) => file && sourcePattern.test(file) && existsSync(path.join(repoRoot, file)))

/** Removes Elixir documentation/comments before checking executable boundary calls.
 * @example
 * executableSource('# Persist.foo()\nPersist.bar()', 'module.ex') === 'Persist.bar()'
 */
export const executableSource = (source, file = 'module.ex') => {
  if (file.endsWith('.ex') || file.endsWith('.exs')) {
    return source.replace(/"""[\s\S]*?"""/g, '').replace(/#.*$/gm, '')
  }

  return source
}

/** Returns whether a path is an active CMS Persist primitive.
 * @example
 * isPersistFile('backend/api/lib/groupher_server/cms/articles/binding_persist.ex') === true
 */
export const isPersistFile = (file) => file.startsWith(cmsRoot) && persistFilePattern.test(file)

const isPersistModule = (name) => /(?:^|\.)(?:Persist|[A-Z][A-Za-z0-9_]*Persist)$/.test(name)

const aliasNames = (source) => {
  const aliases = new Set(['Persist'])

  for (const match of source.matchAll(/^\s*alias\s+([A-Z][A-Za-z0-9_.]*)(?:\s*,\s*as:\s*([A-Z][A-Za-z0-9_]*))?/gm)) {
    const target = match[1]
    const alias = match[2] || target.split('.').at(-1)
    if (isPersistModule(target) || isPersistModule(alias)) aliases.add(alias)
  }

  for (const match of source.matchAll(/^\s*alias\s+([A-Z][A-Za-z0-9_.]*)\.\{([^}]+)\}/gm)) {
    const prefix = match[1]
    for (const item of match[2].split(',')) {
      const [name, explicitAlias] = item.trim().split(/\s*,\s*as:\s*/)
      const target = `${prefix}.${name}`
      const alias = explicitAlias || name
      if (isPersistModule(target) || isPersistModule(alias)) aliases.add(alias)
    }
  }

  return aliases
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Detects direct calls to Persist modules, including bare and `as:` aliases.
 * @example
 * hasDirectPersistCall('alias CMS.Dashboard.Persist\nPersist.update_section(dashboard, args)') === true
 */
export const hasDirectPersistCall = (source, file = 'module.ex') => {
  const executable = executableSource(source, file)
  const qualifiedPersistCall = /(?:\b[A-Z][A-Za-z0-9_]*\.)*(?:Persist|[A-Z][A-Za-z0-9_]*Persist)\s*\.\s*[a-z_][A-Za-z0-9_]*/
  if (qualifiedPersistCall.test(executable)) return true

  return [...aliasNames(executable)].some((alias) =>
    new RegExp(`\\b${escapeRegExp(alias)}\\s*\\.\\s*[a-z_][A-Za-z0-9_]*`).test(executable),
  )
}

/** Detects a boundary that silently manufactures a business command identity.
 * Infrastructure ids (outbox event ids, leases and workflow operation refs)
 * are intentionally outside this check; only expressions naming command_id
 * are considered business command identity fallbacks.
 * @example
 * hasDerivedCommandIdentity('command_id: Ecto.UUID.generate()') === true
 */
export const hasDerivedCommandIdentity = (source, file = 'module.ex') => {
  const executable = executableSource(source, file)

  return [
    /\bcommand_id\s*:\s*Ecto\.UUID\.generate\s*\(/,
    /\bcommand_id\s*=\s*Ecto\.UUID\.generate\s*\(/,
    /\bcommand_id\s*\|\|\s*Ecto\.UUID\.generate\s*\(/,
    /Keyword\.get\([^\n]*:command_id[^\n]*Ecto\.UUID\.generate\s*\(/,
    /Keyword\.get\([^\n]*"command_id"[^\n]*Ecto\.UUID\.generate\s*\(/,
    /Map\.get\([^\n]*:command_id[^\n]*Ecto\.UUID\.generate\s*\(/,
    /Map\.get\([^\n]*"command_id"[^\n]*Ecto\.UUID\.generate\s*\(/,
  ].some((pattern) => pattern.test(executable))
}

const files = repositoryFiles()
const violations = []
const boundaryViolations = []

for (const file of files) {
  if (file.endsWith('frontend/core/query/mutation/optimistic/execute.ts')) continue
  if (file.includes('.test.') || file.includes('/test/')) continue
  const source = readFileSync(path.join(repoRoot, file), 'utf8')
  if (/createCommandId\s*\(/.test(source) || (/from ['"].*optimistic\/execute['"]/.test(source) && /createCommandId/.test(source))) {
    violations.push(file)
  }
}

const persistFiles = files.filter(isPersistFile)

for (const file of persistFiles) {
  const source = executableSource(readFileSync(path.join(repoRoot, file), 'utf8'), file)

  if (/CMS\.Gate\.|CMS\.Command\b|CMS\.Outbox\.|Repo\.(?:transaction|rollback)\b|Ecto\.UUID\.generate\(/.test(source)) {
    boundaryViolations.push(`${file}: Persist must not own Gate, Command, Outbox, transaction, rollback, or command identity`)
  }
}

const resolverFiles = files.filter(
  (file) => file.startsWith('backend/api/lib/groupher_server_web/resolvers/cms/') && file.endsWith('.ex'),
)

const cmsProductionFiles = files.filter(
  (file) =>
    (file.startsWith('backend/api/lib/groupher_server/cms/') ||
      file.startsWith('backend/api/lib/groupher_server_web/resolvers/cms/')) &&
    file.endsWith('.ex'),
)

for (const file of cmsProductionFiles) {
  const source = readFileSync(path.join(repoRoot, file), 'utf8')

  if (hasDerivedCommandIdentity(source, file)) {
    boundaryViolations.push(`${file}: production CMS code must not manufacture command_id`)
  }
}

for (const file of resolverFiles) {
  const source = readFileSync(path.join(repoRoot, file), 'utf8')

  if (hasDirectPersistCall(source, file)) {
    boundaryViolations.push(`${file}: resolver must delegate through a CMS facade or concrete Command`)
  }

  if (hasDerivedCommandIdentity(source, file)) {
    boundaryViolations.push(`${file}: resolver must not manufacture command_id`)
  }
}

const facadeFiles = files.filter((file) => /^backend\/api\/lib\/groupher_server\/cms\/[^/]+\.ex$/.test(file))

for (const file of facadeFiles) {
  const source = readFileSync(path.join(repoRoot, file), 'utf8')

  if (hasDirectPersistCall(source, file)) {
    boundaryViolations.push(`${file}: public facade must not call Persist directly`)
  }

  if (hasDerivedCommandIdentity(source, file)) {
    boundaryViolations.push(`${file}: public facade must not manufacture command_id`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (violations.length > 0) {
    console.error('Direct command identity creation is restricted to the explicit command owner:')
    for (const file of violations) console.error(`- ${file}`)
    process.exit(1)
  }

  if (boundaryViolations.length > 0) {
    console.error('CMS command boundary gate: violations found:')
    for (const violation of boundaryViolations) console.error(`- ${violation}`)
    process.exit(1)
  }

  console.log(`command identity and CMS boundary gates: clean (${persistFiles.length} Persist files scanned)`)
}
