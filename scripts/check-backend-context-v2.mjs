import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { maskElixir } from './check-cms-context-module-boundary.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = path.join(repoRoot, 'backend', 'api', 'lib', 'groupher_server')
const registryPath = path.join(repoRoot, 'backend', 'api', '.context-registry-v2.json')
const modes = new Set(['strict', 'report_only'])
const contextPattern = /^[a-z][a-z0-9_]*$/
const fixedRootFiles = new Set([
  'application.ex',
  'command_pipeline.ex',
  'const.ex',
  'front_desk.ex',
  'release.ex',
  'repo.ex',
])
const fixedRootDirectories = new Set(['command_pipeline'])
const collectionOwners = new Set(['categories', 'commands', 'model', 'workflows'])
const singularOwners = new Set([
  'cache',
  'effects',
  'gate',
  'lifecycle',
  'outbox',
  'persist',
  'policy',
  'projection',
  'query',
  'workflow',
])
const forbiddenArchitectureStems = new Set(['read', 'reader', 'write', 'writer'])
const forbiddenArchitectureModules = new Set(['Read', 'Reader', 'Write', 'Writer'])
const legacyArchitectureStems = new Set(['read_state', 'write_confirmation'])
const legacyArchitecturePaths = new Set([
  'accounts/collect_folders/write_confirmation.ex',
  'cms/interactions/read_state.ex',
  'cms/interactions/read_state',
])
const legacyArchitectureModules = [
  'GroupherServer.Accounts.CollectFolders.WriteConfirmation',
  'GroupherServer.CMS.Interactions.ReadState',
]

const readRegistry = (file = registryPath) => JSON.parse(readFileSync(file, 'utf8'))
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const entriesOf = (directory) =>
  existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : []
const relative = (file) => path.relative(repoRoot, file) || '.'
const elixirFiles = (directory) =>
  entriesOf(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return elixirFiles(absolute)
    return entry.isFile() && entry.name.endsWith('.ex') ? [absolute] : []
  })

const contextModule = (name) => expectedModule(`${name}.ex`).replace('GroupherServer.', '')
const executableLines = (file) => maskElixir(readFileSync(file, 'utf8')).split('\n')

const finding = (items, { category, file, message, mode = 'strict', line }) => {
  items.push({ category, file, line, message, mode })
}

const expectedModule = (relativeFile) => {
  const acronyms = new Map([
    ['ai', 'AI'],
    ['api', 'API'],
    ['cms', 'CMS'],
    ['faq', 'FAQ'],
    ['id', 'ID'],
    ['json', 'JSON'],
    ['url', 'URL'],
  ])
  const segments = relativeFile
    .replace(/\.ex$/, '')
    .split('/')
    .map((segment) => {
      return segment
        .split('_')
        .map((part) => acronyms.get(part) ?? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join('')
    })
  return `GroupherServer.${segments.join('.')}`
}

const declaredModule = (file) => {
  const source = maskElixir(readFileSync(file, 'utf8'))
  return source.match(/^defmodule\s+([A-Za-z0-9_.]+)\s+do\b/m)?.[1]
}

const declaredModules = (file) => {
  const source = maskElixir(readFileSync(file, 'utf8'))
  return [...source.matchAll(/^\s*defmodule\s+([A-Za-z0-9_.]+)\s+do\b/gm)].map(
    (match) => match[1],
  )
}

const checkForbiddenArchitectureNames = (root, contexts, findings) => {
  const visit = (directory, mode) => {
    for (const entry of entriesOf(directory)) {
      const absolute = path.join(directory, entry.name)
      const relativePath = path.relative(root, absolute).split(path.sep).join('/')
      const stem = entry.isFile() ? entry.name.replace(/\.ex$/, '') : entry.name
      const declared =
        entry.isFile() && entry.name.endsWith('.ex') ? declaredModules(absolute) : []
      const forbiddenStem = forbiddenArchitectureStems.has(stem)
      const legacyStem = legacyArchitectureStems.has(stem)
      const forbiddenModule = declared.some((module) =>
        module.split('.').some((segment) => forbiddenArchitectureModules.has(segment)),
      )
      const legacyPath = [...legacyArchitecturePaths].some(
        (candidate) => relativePath === candidate || relativePath.startsWith(`${candidate}/`),
      )
      const legacyModule = legacyArchitectureModules.some(
        (candidate) =>
          declared.some((module) => module === candidate || module.startsWith(`${candidate}.`)),
      )

      if (forbiddenStem || forbiddenModule || legacyStem || legacyPath || legacyModule) {
        finding(findings, {
          category: 'forbidden_architecture_name',
          file: absolute,
          message: 'use a concrete business capability or standard Owner name',
          mode,
        })
      }

      if (entry.isDirectory()) visit(absolute, mode)
    }
  }

  for (const [name, rule] of Object.entries(contexts)) {
    const directory = path.join(root, name)
    if (existsSync(directory)) visit(directory, modes.has(rule.mode) ? rule.mode : 'strict')
  }
}

const validateRegistry = (registry, findings, root) => {
  if (!isRecord(registry)) {
    finding(findings, {
      category: 'invalid_registry',
      file: root,
      message: 'registry must be an object',
    })
    return false
  }
  if (registry.version !== 2) {
    finding(findings, {
      category: 'invalid_registry',
      file: root,
      message: 'registry version must be 2',
    })
  }
  if (!isRecord(registry.contexts)) {
    finding(findings, {
      category: 'invalid_registry',
      file: root,
      message: 'contexts must be an object',
    })
    return false
  }

  for (const [name, rule] of Object.entries(registry.contexts)) {
    if (!contextPattern.test(name)) {
      finding(findings, {
        category: name.endsWith('.ex') ? 'context_path_is_file' : 'nested_context_registration',
        file: path.join(root, name),
        message: 'Context keys must be one-level directory names',
      })
    }
    if (!isRecord(rule) || !modes.has(rule.mode)) {
      finding(findings, {
        category: 'unknown_mode',
        file: path.join(root, name),
        message: 'Context mode must be strict or report_only',
      })
    }
    const extra = isRecord(rule) ? Object.keys(rule).filter((key) => key !== 'mode') : []
    if (extra.length) {
      finding(findings, {
        category: 'invalid_registry',
        file: path.join(root, name),
        message: `Context registry entries only allow mode; found ${extra.join(', ')}`,
      })
    }
  }
  return !findings.some(({ category }) => category === 'invalid_registry')
}

const checkModulePath = (file, relativeFile, mode, findings) => {
  if (!existsSync(file)) return
  const expected = expectedModule(relativeFile)
  const declared = declaredModule(file)
  if (declared !== expected) {
    finding(findings, {
      category: 'module_path_mismatch',
      file,
      message: `expected ${expected}, found ${declared ?? 'no defmodule'}`,
      mode,
    })
  }
}

const walkContextDirectory = ({ contextRoot, directory, mode, ownerScope, findings }) => {
  const entries = entriesOf(directory)
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const child = path.join(directory, entry.name)
    const siblingFacade = fileNames.has(`${entry.name}.ex`)
    let childOwnerScope = ownerScope

    if (collectionOwners.has(entry.name)) {
      childOwnerScope = entry.name
    } else if (singularOwners.has(entry.name)) {
      if (!siblingFacade) {
        finding(findings, {
          category: 'missing_owner_facade',
          file: child,
          message: `${entry.name}/ requires sibling ${entry.name}.ex`,
          mode,
        })
      } else {
        childOwnerScope = entry.name
      }
    } else if (!ownerScope && !siblingFacade) {
      finding(findings, {
        category: 'unknown_internal_directory',
        file: child,
        message: 'non-Owner directory requires a same-path Facade',
        mode,
      })
      childOwnerScope = null
    } else if (siblingFacade) {
      childOwnerScope = null
    }

    if (siblingFacade) {
      const facade = path.join(directory, `${entry.name}.ex`)
      checkModulePath(facade, path.relative(contextRoot, facade), mode, findings)
    }

    walkContextDirectory({
      contextRoot,
      directory: child,
      mode,
      ownerScope: childOwnerScope,
      findings,
    })
  }
}

/** Returns v2 Context layout findings derived only from convention and registry modes. */
export const backendContextV2LayoutFindings = ({
  root = backendRoot,
  registry = readRegistry(),
  requireFullyStrict = false,
} = {}) => {
  const findings = []
  if (!validateRegistry(registry, findings, root)) return findings

  const contexts = registry.contexts
  checkForbiddenArchitectureNames(root, contexts, findings)
  const rootEntries = entriesOf(root)
  const rootDirectories = new Set(
    rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  )
  const rootFiles = new Set(
    rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  )

  for (const entry of rootEntries) {
    const absolute = path.join(root, entry.name)
    if (
      entry.isDirectory() &&
      !fixedRootDirectories.has(entry.name) &&
      !Object.hasOwn(contexts, entry.name)
    ) {
      finding(findings, {
        category: 'unknown_root_directory',
        file: absolute,
        message: 'root directory is not a registered Context',
      })
    }
    if (entry.isFile() && entry.name.endsWith('.ex')) {
      const derived = entry.name.replace(/\.ex$/, '')
      if (!fixedRootFiles.has(entry.name) && !Object.hasOwn(contexts, derived)) {
        finding(findings, {
          category: 'unknown_root_file',
          file: absolute,
          message: 'root file is neither fixed infrastructure nor a Context Facade',
        })
      }
    }
  }

  for (const [name, rule] of Object.entries(contexts)) {
    const mode = modes.has(rule.mode) ? rule.mode : 'strict'
    const directory = path.join(root, name)
    const facade = path.join(root, `${name}.ex`)

    if (requireFullyStrict && mode === 'report_only') {
      finding(findings, {
        category: 'report_only_registration',
        file: directory,
        message: 'fully strict registry cannot contain report_only Contexts',
      })
    }
    if (!rootDirectories.has(name)) {
      finding(findings, {
        category: 'missing_context_directory',
        file: directory,
        message: 'registered Context directory is missing',
        mode,
      })
      continue
    }
    if (!rootFiles.has(`${name}.ex`)) {
      finding(findings, {
        category: 'missing_context_facade',
        file: facade,
        message: `registered Context ${name} requires sibling facade ${name}.ex`,
        mode,
      })
    } else {
      checkModulePath(facade, `${name}.ex`, mode, findings)
    }

    walkContextDirectory({ contextRoot: root, directory, mode, ownerScope: null, findings })
  }

  return findings
}

const roleNames = new Set([...collectionOwners, ...singularOwners])
const infrastructurePattern =
  /\b(?:Repo|ORM|Transaction|Ecto\.Multi|Ecto\.Adapters\.SQL|Oban|Req|Tesla|Finch|HTTPoison|ExAws|Cachex|Redix)\./
const workerInfrastructurePattern =
  /\b(?:Repo|ORM|Transaction|Ecto\.Multi|Ecto\.Adapters\.SQL|Req|Tesla|Finch|HTTPoison|ExAws|Cachex|Redix)\./
const runtimeLine = (line) => !/^\s*@(?:spec|type|typep|callback|macrocallback)\b/.test(line)

const facadeFiles = (root, registry) => {
  const result = new Set([path.join(root, 'front_desk.ex')])
  for (const name of Object.keys(registry.contexts)) result.add(path.join(root, `${name}.ex`))
  for (const file of elixirFiles(root)) {
    const stem = file.replace(/\.ex$/, '')
    const base = path.basename(stem)
    if (existsSync(stem) && !roleNames.has(base)) result.add(file)
  }
  return [...result].filter(existsSync)
}

/** Returns convention-derived runtime, Facade, boundary, and dependency findings. */
export const backendContextV2SemanticFindings = ({
  root = backendRoot,
  registry = readRegistry(),
} = {}) => {
  const findings = []
  if (!isRecord(registry?.contexts)) return findings
  const names = Object.keys(registry.contexts)
  const moduleToName = new Map(names.map((name) => [contextModule(name), name]))
  const moduleAlternation = [...moduleToName.keys()].sort((a, b) => b.length - a.length).join('|')
  const invocationSuffix = '(?:\\s*\\(|\\s+[^=]|\\s*\\/\\s*\\d+)'
  const internalCall = new RegExp(
    `(?<![A-Za-z0-9_.])(?:GroupherServer\\.)?(${moduleAlternation})\\.([A-Z][A-Za-z0-9_.]*)\\.((?!t\\b)[a-z_][A-Za-z0-9_?!]*)${invocationSuffix}`,
    'g',
  )
  const rootCall = new RegExp(
    `(?<![A-Za-z0-9_.])(?:GroupherServer\\.)?(${moduleAlternation})\\.((?!t\\b)[a-z_][A-Za-z0-9_?!]*)${invocationSuffix}`,
    'g',
  )
  const edges = new Map(names.map((name) => [name, new Set()]))
  const edgeEvidence = new Map()

  for (const file of facadeFiles(root, registry)) {
    const contextName = path.relative(root, file).split(path.sep)[0].replace(/\.ex$/, '')
    const mode = registry.contexts[contextName]?.mode ?? 'strict'
    executableLines(file).forEach((line, index) => {
      if (runtimeLine(line) && infrastructurePattern.test(line)) {
        finding(findings, {
          category: 'facade_infrastructure_access',
          file,
          line: index + 1,
          message: 'Facade must delegate infrastructure access to an Owner',
          mode,
        })
      }
      const moduleEscape = line.match(
        /^\s*def(?:p|macro|guard)?\s+[^,]+,\s*do:\s*(?:GroupherServer\.)?([A-Z][A-Za-z0-9_]*)\.([A-Z][A-Za-z0-9_.]*)\s*$/,
      )
      if (moduleEscape && moduleToName.has(moduleEscape[1])) {
        finding(findings, {
          category: 'facade_internal_module_escape',
          file,
          line: index + 1,
          message: 'Facade must expose a concrete function instead of returning an internal module',
          mode,
        })
      }
    })
  }

  const productionFiles = [
    ...elixirFiles(root),
    ...elixirFiles(path.join(path.dirname(root), 'groupher_server_web')),
  ]
  for (const file of productionFiles) {
    const relativeFile = path.relative(root, file)
    const relativeSegments = relativeFile.split(path.sep)
    const firstSegment = relativeFile.startsWith('..') ? null : relativeFile.split(path.sep)[0]
    const callerName = firstSegment?.replace(/\.ex$/, '') ?? null
    const callerMode = registry.contexts[callerName]?.mode ?? 'strict'
    const rawSource = readFileSync(file, 'utf8')
    const lines = maskElixir(rawSource).split('\n')
    const maskedSource = lines.join('\n')
    const aliases = new Map()
    const directAlias = new RegExp(
      `^\\s*alias\\s+(?:GroupherServer\\.)?(${moduleAlternation})(?:\\.([A-Z][A-Za-z0-9_]*(?:\\.[A-Z][A-Za-z0-9_]*)*))?(?:\\s*,\\s*as:\\s*([A-Z][A-Za-z0-9_]*))?\\s*$`,
      'gm',
    )
    for (const match of maskedSource.matchAll(directAlias)) {
      const internal = match[2] ?? null
      aliases.set(match[3] ?? internal?.split('.').at(-1) ?? match[1], {
        internal,
        targetName: moduleToName.get(match[1]),
        targetModule: internal ? `${match[1]}.${internal}` : match[1],
      })
    }
    const groupedAlias = new RegExp(
      `\\balias\\s+(?:GroupherServer\\.)?(${moduleAlternation})\\.\\{([^}]+)\\}`,
      'gs',
    )
    for (const match of maskedSource.matchAll(groupedAlias)) {
      for (const entry of match[2]
        .split(',')
        .map((item) => item.trim())
        .filter((item) => /^[A-Z][A-Za-z0-9_.]*$/.test(item))) {
        aliases.set(entry.split('.').at(-1), {
          internal: entry,
          targetName: moduleToName.get(match[1]),
          targetModule: `${match[1]}.${entry}`,
        })
      }
    }
    const worker = lines.some((line) => /\buse\s+Oban\.Worker\b/.test(line))

    if (/\b(?:Helper\.Later|Jobs\.Later|Jobs\.(?:later|enqueue_later))\b/.test(maskedSource)) {
      finding(findings, {
        category: 'dynamic_job_callback',
        file,
        message: 'persist a typed Job contract instead of a module/function/arguments callback',
        mode: callerMode,
      })
    }

    if (worker && /\b(?:Kernel\.)?apply\s*\(/.test(maskedSource)) {
      finding(findings, {
        category: 'dynamic_job_callback',
        file,
        message: 'Worker must dispatch a finite typed contract instead of apply/3',
        mode: callerMode,
      })
    }

    for (const transaction of maskedSource.matchAll(/\bRepo\.transaction\(fn\s*->[\s\S]{0,4000}?\bend\s*\)/g)) {
      if (/fn\s*->\s*\{:error\s*,/.test(transaction[0])) {
        finding(findings, {
          category: 'transaction_error_without_rollback',
          file,
          message: 'use Repo.transact_result/1 or Repo.rollback/1 for tagged transaction failures',
          mode: callerMode,
        })
      }
    }

    const workerRuntimeSource = lines.filter((line) => runtimeLine(line)).join('\n')
    const quotedPayloadKeys = rawSource
      .replace(/^\s*#.*$/gm, '')
      .match(/["'](?:module|function|args|kind)["']\s*=>/)
    const atomPayloadKeys = /\b(?:module|function|kind)\s*:/.test(workerRuntimeSource)
    if (worker && (quotedPayloadKeys || atomPayloadKeys)) {
      finding(findings, {
        category: 'unstable_job_payload',
        file,
        message: 'Worker payloads must use typed business fields; kind and callback fields are forbidden',
        mode: callerMode,
      })
    }

    if (worker && callerName !== 'jobs') {
      finding(findings, {
        category: 'worker_outside_jobs',
        file,
        message: 'Oban workers must live in the Jobs Context',
        mode: callerMode,
      })
    }

    lines.forEach((line, index) => {
      if (worker && runtimeLine(line) && workerInfrastructurePattern.test(line)) {
        finding(findings, {
          category: 'worker_infrastructure_access',
          file,
          line: index + 1,
          message: 'Worker must call a Context Facade instead of infrastructure',
          mode: callerMode,
        })
      }

      if (!runtimeLine(line)) return

      const rootImport = new RegExp(
        `\\bimport\\s+(?:GroupherServer\\.)?(${moduleAlternation})(?!\\.)\\b`,
      ).exec(line)
      if (rootImport) {
        const targetName = moduleToName.get(rootImport[1])
        finding(findings, {
          category: 'root_context_import',
          file,
          line: index + 1,
          message: `call ${rootImport[1]} explicitly instead of importing its root Facade`,
          mode: registry.contexts[targetName]?.mode ?? 'strict',
        })
      }

      const outboxCall = (() => {
        const direct = /\b(?:GroupherServer\.)?CMS\.Outbox\.(send|execute|mark_failed)\b/.exec(line)
        if (direct) return direct[1]
        for (const [local, target] of aliases) {
          const suffix =
            target.targetModule === 'CMS.Outbox'
              ? ''
              : target.targetModule === 'CMS'
                ? 'Outbox\\.'
                : null
          if (suffix === null) continue
          const aliased = new RegExp(
            `(?<![A-Za-z0-9_.])${local}\\.${suffix}(send|execute|mark_failed)\\b`,
          ).exec(line)
          if (aliased) return aliased[1]
        }
        return null
      })()
      if (
        outboxCall === 'send' &&
        !relativeSegments.includes('effects.ex') &&
        !relativeSegments.includes('effects')
      ) {
        finding(findings, {
          category: 'outbox_write_outside_effects',
          file,
          line: index + 1,
          message: 'CMS.Outbox.send/1 may only be called from an Effects Owner',
          mode: callerMode,
        })
      }
      if (
        (outboxCall === 'execute' || outboxCall === 'mark_failed') &&
        !(
          callerName === 'cms' &&
          relativeSegments[1] === 'outbox' &&
          (relativeSegments[2] === 'workflow' || relativeSegments[2] === 'workflow.ex')
        )
      ) {
        finding(findings, {
          category: 'outbox_delivery_outside_workflow',
          file,
          line: index + 1,
          message: `CMS.Outbox.${outboxCall} may only be called from CMS.Outbox.Workflow`,
          mode: callerMode,
        })
      }

      const foreignDirective = new RegExp(
        `\\b(?:import|require|use)\\s+(?:GroupherServer\\.)?(${moduleAlternation})\\.([A-Z][A-Za-z0-9_.]*)`,
      ).exec(line)
      const errorPatternRequire =
        foreignDirective && /\brequire\b/.test(line) && foreignDirective[2].endsWith('ErrorCat')
      if (foreignDirective && !errorPatternRequire) {
        const targetName = moduleToName.get(foreignDirective[1])
        if (targetName && targetName !== callerName) {
          finding(findings, {
            category: 'context_boundary',
            file,
            line: index + 1,
            message: `${callerName ?? 'runtime entrypoint'} must not import, require, or use ${foreignDirective[1]}.${foreignDirective[2]}`,
            mode: registry.contexts[targetName]?.mode ?? 'strict',
          })
        }
      }

      const foreignDelegate = new RegExp(
        `\\bto:\\s*(?:GroupherServer\\.)?(${moduleAlternation})\\.([A-Z][A-Za-z0-9_.]*)`,
      ).exec(line)
      if (foreignDelegate) {
        const targetName = moduleToName.get(foreignDelegate[1])
        if (targetName && targetName !== callerName) {
          finding(findings, {
            category: 'context_boundary',
            file,
            line: index + 1,
            message: `${callerName ?? 'runtime entrypoint'} must delegate through ${foreignDelegate[1]} instead of ${foreignDelegate[1]}.${foreignDelegate[2]}`,
            mode: registry.contexts[targetName]?.mode ?? 'strict',
          })
        }
      }

      internalCall.lastIndex = 0
      for (const match of line.matchAll(internalCall)) {
        const targetName = moduleToName.get(match[1])
        if (!targetName || targetName === callerName) continue
        finding(findings, {
          category: 'context_boundary',
          file,
          line: index + 1,
          message: `${callerName ?? 'runtime entrypoint'} must call ${match[1]} instead of ${match[1]}.${match[2]}.${match[3]}`,
          mode: registry.contexts[targetName]?.mode ?? 'strict',
        })
      }

      for (const [local, target] of aliases) {
        if (!target.targetName) continue
        const aliasCall = new RegExp(
          `(?<![A-Za-z0-9_.])${local}\\.([a-z_][A-Za-z0-9_?!]*)(?:\\s*\\(|\\s+[^=]|\\s*\\/\\s*\\d+)`,
        )
        const aliasMatch = line.match(aliasCall)
        if (!aliasMatch || aliasMatch[1] === 't' || aliasMatch[1] === 'error_pattern') continue
        if (target.internal && target.targetName !== callerName) {
          finding(findings, {
            category: 'context_boundary',
            file,
            line: index + 1,
            message: `${callerName ?? 'runtime entrypoint'} must call ${contextModule(target.targetName)} instead of aliased ${target.targetModule}.${aliasMatch[1]}`,
            mode: registry.contexts[target.targetName]?.mode ?? 'strict',
          })
        }
        if (!target.internal) {
          const callerFacade = callerName && file === path.join(root, `${callerName}.ex`)
          if (callerFacade && callerName !== target.targetName) {
            edges.get(callerName)?.add(target.targetName)
            edgeEvidence.set(
              `${callerName}->${target.targetName}`,
              `${relative(file)}:${index + 1}`,
            )
          }
          if (callerName && callerName === target.targetName && !callerFacade) {
            finding(findings, {
              category: 'reverse_context_facade_call',
              file,
              line: index + 1,
              message: `internal ${callerName} code must not call its own Context Facade`,
              mode: callerMode,
            })
          }
        }
      }

      rootCall.lastIndex = 0
      for (const match of line.matchAll(rootCall)) {
        const targetName = moduleToName.get(match[1])
        const callerFacade = callerName && file === path.join(root, `${callerName}.ex`)
        if (callerFacade && targetName && callerName !== targetName) {
          edges.get(callerName)?.add(targetName)
          edgeEvidence.set(`${callerName}->${targetName}`, `${relative(file)}:${index + 1}`)
        }
        if (
          callerName &&
          targetName === callerName &&
          !file.endsWith(`${path.sep}${callerName}.ex`)
        ) {
          finding(findings, {
            category: 'reverse_context_facade_call',
            file,
            line: index + 1,
            message: `internal ${callerName} code must not call its own Context Facade`,
            mode: callerMode,
          })
        }
      }
    })
  }

  const recordedCycles = new Set()
  const visit = (name, stack = []) => {
    if (stack.includes(name)) {
      const cycle = [...stack.slice(stack.indexOf(name)), name]
      const key = [...new Set(cycle.slice(0, -1))].sort().join('|')
      if (!recordedCycles.has(key)) {
        recordedCycles.add(key)
        const evidence = cycle
          .slice(0, -1)
          .map((source, index) => edgeEvidence.get(`${source}->${cycle[index + 1]}`))
          .filter(Boolean)
          .join(', ')
        finding(findings, {
          category: 'context_dependency_cycle',
          file: root,
          message: `${cycle.join(' -> ')} (${evidence})`,
          mode: 'strict',
        })
      }
      return
    }
    for (const target of edges.get(name) ?? []) visit(target, [...stack, name])
  }
  for (const name of names) visit(name)

  return findings
}

/** Returns all v2 layout and dependency findings for the requested source roots. */
export const backendContextV2Findings = (options = {}) => [
  ...backendContextV2LayoutFindings(options),
  ...backendContextV2SemanticFindings(options),
]

const formatFinding = ({ category, file, line, message, mode }) =>
  `- ${relative(file)}${line ? `:${line}` : ''}: ${mode}: ${category}: ${message}`

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fullyStrict = process.argv.includes('--fully-strict')
  const findings = backendContextV2Findings({ requireFullyStrict: fullyStrict })
  console.log(`Backend context v2 report: ${findings.length} findings`)
  if (findings.length) console.log(findings.map(formatFinding).join('\n'))
  if (findings.some(({ mode }) => mode === 'strict')) process.exitCode = 1
}
