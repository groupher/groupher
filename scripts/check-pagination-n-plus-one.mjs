import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { maskElixir } from './check-cms-context-module-boundary.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = path.join(repoRoot, 'backend', 'api', 'lib')
const manifestPath = path.join(repoRoot, 'backend', 'api', 'priv', 'pagination_n_plus_one_inventory.json')

const sourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(absolute)
    return entry.isFile() && entry.name.endsWith('.ex') ? [absolute] : []
  })

const relativePath = (file) => path.relative(repoRoot, file).split(path.sep).join('/')

const collectionCall = /\bEnum\.(?:map|flat_map|filter|reduce|reduce_while|each)\s*\(/
const perItemRead =
  /\b(?:FrontDesk\.(?:article|article_of)|Repo\.(?:get|get!|get_by|get_by!|one)|ORM\.(?:find|find_by)|(?:CMS\.)?Gate\.with_(?:community_)?check|(?:CMS\.)?Articles\.MutationLock\.transact_(?:article|doc))\s*\(/
// A helper reachable from a collection builder must use the same read contract
// as an inline collection body; otherwise Repo/FrontDesk reads can hide behind
// a local helper while Gate/MutationLock are the only patterns being reported.
const collectionHelperRead = perItemRead
const listFunction =
  /(?:page|list|load|search|article|comment|community|user|mention|ref|build|collect|hydrate|merge|item|usage)/i
const escapeRegExp = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
const helperReference = (name, line) => {
  if (/^\s*@(?:spec|doc|impl|behaviour)\b/.test(line)) return false

  return new RegExp(
    `(?:&${escapeRegExp(name)}(?:/\\d+\\b|\\s*\\()|(?<![.\\w])${escapeRegExp(name)}\\s*\\()`,
  ).test(line)
}
const blockOpen = /\b(?:fn|case|cond|if|unless|with|for|try|receive)\b|\bdo\b(?!:)/g
const blockClose = /\bend\b/g

const blockBalance = (line) =>
  (line.match(blockOpen)?.length ?? 0) - (line.match(blockClose)?.length ?? 0)

const nonPaginationWorkflowSources = new Set([
  'backend/api/lib/groupher_server/cms/communities/tags/stats.ex',
  'backend/api/lib/groupher_server/cms/content_import/staging.ex',
  'backend/api/lib/groupher_server/cms/doc_cover/persist.ex',
  'backend/api/lib/groupher_server/cms/doc_publish_release/workflow.ex',
  'backend/api/lib/groupher_server/cms/doc_tree/publish/checklist.ex',
  'backend/api/lib/groupher_server/cms/seeds/lite_home.ex',
])

const allowlistedFindings = [
  {
    function: 'public_article_for',
    line: 224,
    path_kind: 'background',
    reason: 'background reindex binding fan-out; max 500 roots per batch',
    source: 'backend/api/lib/groupher_server/cms/search_artiments/indexer.ex',
    symbol: 'FrontDesk.article',
  }
]

const allowlistEntry = (finding) =>
  allowlistedFindings.find(
    (entry) =>
      entry.source === finding.source &&
      entry.function === finding.function &&
      entry.line === finding.line &&
      entry.path_kind === 'background' &&
      entry.symbol === finding.symbol,
  )

/** Reports database/canonical reads inside collection functions without changing source. */
export const paginationNPlusOneInventory = (root = backendRoot) => {
  const findings = []

  for (const file of sourceFiles(root)) {
    const sourceRelative = relativePath(file)
    if (nonPaginationWorkflowSources.has(sourceRelative)) continue

    const source = readFileSync(file, 'utf8')
    const lines = maskElixir(source).split('\n')
    let currentFunction = null
    let hasCollection = false
    let collectionCallbackBalance = 0
    const collectionFunctions = []
    const functionBodies = []

    lines.forEach((line, index) => {
      const functionMatch = line.match(/^\s*defp?\s+([a-z_][A-Za-z0-9_!?]*)/)
      if (functionMatch) {
        currentFunction = functionMatch[1]
        hasCollection = false
        collectionCallbackBalance = 0
        functionBodies.push({ function: currentFunction, start: index, lines: [] })
      }

      if (collectionCall.test(line)) {
        hasCollection = true
        if (currentFunction) collectionFunctions.push(currentFunction)
      }

      const inCollectionCallback =
        collectionCallbackBalance > 0 || (collectionCall.test(line) && /\bfn\b/.test(line))

      if (inCollectionCallback) {
        collectionCallbackBalance += blockBalance(line)
      }

      if (currentFunction) functionBodies.at(-1).lines.push({ line, index })
      const match = line.match(perItemRead)

      if (
        match &&
        currentFunction &&
        hasCollection &&
        inCollectionCallback &&
        listFunction.test(currentFunction)
      ) {
        const finding = {
          function: currentFunction,
          kind: 'collection_read',
          line: index + 1,
          source: relativePath(file),
          symbol: match[0].replace(/\s*\($/, ''),
        }
        const allowlist = allowlistEntry(finding)

        findings.push({
          ...finding,
          disposition: allowlist ? 'background_exception' : 'requires_migration',
          path_kind: allowlist?.path_kind ?? 'request',
          reason: allowlist?.reason ?? null,
        })
      }
    })

    functionBodies.forEach((body) => {
      const wrapper = body.lines.find(({ line }) => collectionHelperRead.test(line))
      if (!wrapper) return

      const root = collectionFunctions.find((name) =>
        functionBodies.some((candidate) => {
          if (candidate.function !== name || !listFunction.test(candidate.function)) return false
          const collectionLine = candidate.lines.find(({ line }) => collectionCall.test(line))
          return collectionLine
            ? candidate.lines.some(
                ({ line, index }) =>
                  index >= collectionLine.index && helperReference(body.function, line),
              )
            : false
        }),
      )
      if (!root || root === body.function || !listFunction.test(root)) return

      const match = wrapper.line.match(collectionHelperRead)
      const finding = {
        function: body.function,
        kind: 'collection_helper_read',
        line: wrapper.index + 1,
        source: relativePath(file),
        symbol: match[0].replace(/\s*\($/, ''),
        via_function: root,
      }
      const allowlist = allowlistEntry(finding)

      findings.push({
        ...finding,
        disposition: allowlist ? 'background_exception' : 'requires_migration',
        path_kind: allowlist?.path_kind ?? 'request',
        reason: allowlist?.reason ?? null,
      })
    })
  }

  const uniqueFindings = Array.from(
    new Map(findings.map((finding) => [
      `${finding.source}:${finding.line}:${finding.symbol}:${finding.function}`,
      finding,
    ])).values(),
  )

  uniqueFindings.sort((left, right) => left.source.localeCompare(right.source) || left.line - right.line)

  return {
    generated_from: 'backend/api/lib',
    schema: 2,
    scope: {
      excluded: [
        'comments, documentation strings and tests after Elixir masking',
        'non-pagination import, seed, cover and publish workflows listed in the source classifier',
      ],
      mode: 'report_only',
      note: 'Product request-path collection reads must be batched; only explicitly classified background work may remain allowlisted at an exact source occurrence.',
    },
    allowlist: allowlistedFindings,
    summary: {
      findings: uniqueFindings.length,
      files: new Set(uniqueFindings.map((finding) => finding.source)).size,
    },
    findings: uniqueFindings,
  }
}

const report = (manifest) =>
  [
    `Pagination N+1 inventory: ${manifest.summary.findings} collection reads in ${manifest.summary.files} files`,
    ...manifest.findings.map(
      (finding) =>
        `- ${finding.source}:${finding.line} ${finding.function} ${finding.symbol} [${finding.disposition}]${finding.reason ? ` ${finding.reason}` : ''}`,
    ),
  ].join('\n')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = paginationNPlusOneInventory()
  console.log(report(manifest))

  if (process.argv.includes('--strict')) {
    const disallowed = manifest.findings.filter((finding) => finding.disposition !== 'background_exception')

    if (disallowed.length > 0) {
      console.error('Pagination N+1 strict gate failed: unallowlisted collection reads remain.')
      process.exit(1)
    }

    console.log('Pagination N+1 strict gate passed.')
  }

  if (process.argv.includes('--check')) {
    if (!existsSync(manifestPath)) {
      console.error(`Missing ${relativePath(manifestPath)}; run with --write first.`)
      process.exit(1)
    }

    const expected = `${JSON.stringify(manifest, null, 2)}\n`
    if (readFileSync(manifestPath, 'utf8') !== expected) {
      console.error(`Stale ${relativePath(manifestPath)}; run with --write first.`)
      process.exit(1)
    }
    console.log(`Pagination N+1 inventory is fresh: ${relativePath(manifestPath)}`)
  }

  if (process.argv.includes('--write')) {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Wrote ${relativePath(manifestPath)}`)
  }
}
