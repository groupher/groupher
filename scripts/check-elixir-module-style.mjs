/**
 * Enforces Groupher's Elixir module-header and alias conventions.
 *
 * Credo owns general readability checks. This script covers repository-specific
 * namespace and documentation rules that Credo's generic checks cannot express.
 * It is also the sole owner of the alias ordering Groupher requires:
 * directives stay in their semantic blocks, `__MODULE__` comes first, and a
 * GroupherServer root alias precedes aliases through its shortened child.
 * Ordering inside a semantic alias group is intentionally not alphabetical.
 */

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(root, 'backend/api/lib/groupher_server')
const testRoot = path.join(root, 'backend/api/test')
const allElixirRoots = [
  path.join(root, 'backend/api/lib'),
  testRoot,
  path.join(root, 'backend/api/scripts'),
]
const groupherRootModules = new Set(
  fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ex'))
    .flatMap((entry) => {
      const source = fs.readFileSync(path.join(sourceRoot, entry.name), 'utf8')
      const match = /^defmodule GroupherServer\.([A-Z][A-Za-z0-9_]*)\b/m.exec(source)
      return match ? [match[1]] : []
    }),
)
const failures = []

const errorCatInfrastructure = (file) =>
  file === path.join(root, 'backend/api/lib/groupher_server/error_cat.ex') ||
  file.startsWith(`${path.join(root, 'backend/api/lib/groupher_server/error_cat')}${path.sep}`)

const forbiddenQualifiedErrorCat =
  /GroupherServer\.ErrorCat\.Error\b|GroupherServer\.ErrorCat\.(?:custom|default|gate_unknown|gq_format|code)\b|GroupherServer(?:Web)?\.(?:Accounts|CMS)(?:\.[A-Za-z0-9_]+)*\.ErrorCat\.(?:Error\b|[a-zA-Z_][A-Za-z0-9_]*\s*\()/

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(file)
    return file.endsWith('.ex') || file.endsWith('.exs') ? [file] : []
  })

const fail = (file, line, message) =>
  failures.push(`${path.relative(root, file)}:${line}: ${message}`)

for (const file of allElixirRoots.flatMap(walk)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const productionFile = file.startsWith(`${sourceRoot}${path.sep}`)
  const firstDefinition = lines.findIndex(
    (line, index) => index > 0 && /^  def(?:p|macro|guard|delegate)?\s/.test(line),
  )
  const headerEnd = firstDefinition === -1 ? lines.length : firstDefinition
  const header = lines.slice(0, headerEnd)
  const moduleDirectives = []
  let inModuledoc = false
  let sawModuledoc = false

  for (let index = 0; index < header.length; index += 1) {
    const line = header[index]

    if (!sawModuledoc && /^  @moduledoc\s+"""/.test(line)) {
      sawModuledoc = true
      inModuledoc = (line.match(/"""/g) || []).length < 2
      continue
    }

    if (inModuledoc) {
      if (line.includes('"""')) inModuledoc = false
      continue
    }

    const directive = /^  (use|require|import|alias)\b/.exec(line)
    if (directive) moduleDirectives.push({ kind: directive[1], line: index + 1 })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (
      !file.startsWith(`${sourceRoot}${path.sep}error_cat${path.sep}`) &&
      !line.includes('alias GroupherServer.ErrorCat.Error') &&
      /^\s+alias GroupherServer\.[A-Z][A-Za-z0-9_]*\./.test(line)
    ) {
      fail(file, index + 1, 'alias the GroupherServer root first, then use the shortened child module')
    }
    if (/^\s+alias .*\.Model(?:\.[A-Za-z0-9_.]+|\.\{[^}]+\}),\s*as:/.test(line)) {
      fail(file, index + 1, 'Model modules keep their canonical names; rename the conflicting role')
    }
    if (/^\s+alias GroupherServer\.\{[^}]*\.[^}]*\}/.test(line)) {
      fail(file, index + 1, 'GroupherServer root groups may contain only direct child modules')
    }
    if (/^\s+(?:require|import) (?:Accounts|CMS)\./.test(line)) {
      fail(file, index + 1, 'require/import precede aliases and must use the full GroupherServer module')
    }
    const contextAlias =
      /^\s+alias (?:Accounts|CMS)\.Gate\.Context\.[A-Za-z0-9_.]+,\s+as:\s*([A-Z][A-Za-z0-9_]*)/.exec(
        line,
      )
    if (contextAlias && !contextAlias[1].endsWith('Context')) {
      fail(file, index + 1, 'Gate Context aliases use the canonical *Context suffix')
    }
    if (
      /^\s*@/.test(line) &&
      !/^\s*@(?:spec|doc|moduledoc)\b/.test(line) &&
      line.includes('GroupherServer.CMS.')
    ) {
      fail(file, index + 1, 'module attributes use the CMS alias instead of a full module name')
    }
    const code = line.replace(/#.*/, '')
    if (
      !errorCatInfrastructure(file) &&
      forbiddenQualifiedErrorCat.test(code)
    ) {
      fail(
        file,
        index + 1,
        'code uses a local ErrorCat alias; fully qualified ErrorCat references are reserved for the ErrorCat infrastructure',
      )
    }
  }

  const firstUse = moduleDirectives.find((directive) => directive.kind === 'use')
  const firstUseLine = firstUse ? lines[firstUse.line - 1] : ''
  // The Articles factory macro expands caller functions that read these attrs,
  // so its `use` must remain below the factory defaults in Support.Factory.
  const useReadsCallerAttributes = firstUseLine.includes('Support.Factory.Articles')
  if (firstUse && moduleDirectives[0].kind !== 'use' && !useReadsCallerAttributes) {
    fail(
      file,
      firstUse.line,
      'use must be the first module directive, before require, import, and alias',
    )
  }

  if (file.startsWith(`${testRoot}${path.sep}`)) {
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes('GroupherServer.ErrorCat.Error')) {
        fail(file, index + 1, 'tests use the TestMate/local ErrorCat alias instead of the full module name')
      }
    }
  }

  if (!productionFile) continue

  const moduleLine = lines.findIndex((line) => /^defmodule\s/.test(line))
  const moduledocLine = lines.findIndex((line) => /^  @moduledoc\b/.test(line))
  if (moduleLine !== -1 && moduledocLine !== -1) {
    for (let index = moduleLine + 1; index < moduledocLine; index += 1) {
      if (/^  (?:use|require|import|alias)\b/.test(lines[index])) {
        fail(file, index + 1, 'module directives must appear below @moduledoc')
      }
    }
  }

  const directiveRank = { require: 0, import: 1, alias: 2 }
  let highestRank = -1
  for (const directive of moduleDirectives) {
    if (!(directive.kind in directiveRank)) continue
    const rank = directiveRank[directive.kind]
    if (rank < highestRank) {
      fail(file, directive.line, 'module directives must be ordered require, import, alias')
    }
    highestRank = Math.max(highestRank, rank)
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*@spec\b/.test(lines[index])) continue
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\s*@doc\b/.test(lines[cursor])) {
        fail(file, index + 1, '@doc must appear before its @spec')
        break
      }
      if (/^\s*def(?:p|macro|guard|delegate)?\s/.test(lines[cursor])) break
    }
  }

  const aliasesByParent = new Map()
  const rootAliasLocations = new Map()
  let firstAlias = -1
  let moduleAlias = -1
  for (let index = 0; index < header.length; index += 1) {
    if (/^  alias\b/.test(header[index]) && firstAlias === -1) firstAlias = index
    if (moduleAlias === -1 && /^  alias __MODULE__/.test(header[index])) moduleAlias = index

    const directRootAlias = /^  alias GroupherServer\.([A-Z][A-Za-z0-9_]*)$/.exec(header[index])
    if (directRootAlias) rootAliasLocations.set(directRootAlias[1], index)

    const groupedRootAlias = /^  alias GroupherServer\.\{([^}]+)\}$/.exec(header[index])
    if (groupedRootAlias) {
      for (const child of groupedRootAlias[1].split(',').map((value) => value.trim())) {
        rootAliasLocations.set(child, index)
      }
    }

    const match = /^  alias ([A-Z][A-Za-z0-9_.]+)$/.exec(header[index])
    if (!match) continue
    const segments = match[1].split('.')
    if (segments.length < 2) continue
    const parent = segments.slice(0, -1).join('.')
    if (!aliasesByParent.has(parent)) aliasesByParent.set(parent, [])
    aliasesByParent.get(parent).push(index + 1)
  }
  for (const [parent, locations] of aliasesByParent) {
    if (locations.length > 1) {
      fail(file, locations[1], `group sibling aliases with ${parent}.{...}`)
    }
  }

  if (moduleAlias !== -1 && firstAlias !== moduleAlias) {
    fail(file, moduleAlias + 1, 'alias __MODULE__ must be the first alias in its list')
  }

  for (let index = 0; index < header.length; index += 1) {
    const shortenedChild = /^  alias ([A-Z][A-Za-z0-9_]*)\.(?:[A-Z{])/.exec(header[index])
    if (!shortenedChild) continue

    if (!groupherRootModules.has(shortenedChild[1])) continue

    const rootLocation = rootAliasLocations.get(shortenedChild[1])
    if (rootLocation === undefined || rootLocation > index) {
      fail(
        file,
        index + 1,
        `alias GroupherServer.${shortenedChild[1]} before aliases through ${shortenedChild[1]}`,
      )
    }
  }

  const aliasesByCommonParent = new Map()
  for (let index = 0; index < header.length; index += 1) {
    const match = /^  alias ((?:CMS|Activity|Accounts|Auth|Analysis|Messaging|Jobs|Support|Repo)\.[A-Z][A-Za-z0-9_.]+)$/.exec(
      header[index],
    )
    if (!match) continue
    const segments = match[1].split('.')
    if (segments.length < 3) continue
    const parent = segments.slice(0, 2).join('.')
    const child = segments.slice(2).join('.')
    if (!aliasesByCommonParent.has(parent)) aliasesByCommonParent.set(parent, [])
    aliasesByCommonParent.get(parent).push({ index, child })
  }
  for (const [parent, entries] of aliasesByCommonParent) {
    const topLevelChildren = new Set(entries.map(({ child }) => child.split('.')[0]))
    if (topLevelChildren.size > 1) {
      fail(file, entries[1].index + 1, `group sibling aliases with ${parent}.{...}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Elixir module style failed with ${failures.length} issue(s):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('Elixir module style passed.')
}
