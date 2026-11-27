import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = 'backend/api/dev'
const fixtureFiles = [
  'local_test_actors.ex',
  'local_test_actors/communities.ex',
  'local_test_actors/grants.ex',
]

// Each exception is a specific existing tool operation, not a general
// permission for fixture code to write product tables.
const writes = new Map([
  ['local_test_actors.ex:close_run:update', 'seal run-owned fixture bindings'],
  ['local_test_actors.ex:mark_cleanup_complete:update', 'persist cleanup results in fixture bindings'],
  ['seed/article/create.ex:put_entry:update', 'store article intent and verified reference in fixture binding'],
  ['seed/actor/create.ex:register:update', 'finish the synthetic account fixture binding'],
  ['seed/community/create.ex:run:update', 'store community ownership in fixture binding'],
  ['local_test_actors/grants.ex:record_global:update', 'store original global grant in fixture binding'],
  ['local_test_actors/grants.ex:record_lord:update', 'store test lord provenance in fixture binding'],
  ['local_test_actors/grants.ex:lord:insert', 'initialize a verified synthetic test lord'],
  ['seed/cleanup/run.ex:restore_global:update', 'mark global grant cleanup in fixture binding'],
  ['seed/cleanup/run.ex:restore_global_row:delete', 'restore a run-owned synthetic global grant'],
  ['seed/cleanup/run.ex:restore_global_row:update', 'restore the previous global grant'],
  ['seed/cleanup/run.ex:remove_admin:delete', 'remove a verified test-created lord'],
  ['seed/admin/invite.ex:store:update', 'store invitation identity in fixture binding'],
  ['seed/admin/accept.ex:store:update', 'store acceptance identity in fixture binding'],
  ['seed/admin/membership.ex:store:update', 'store membership operation in fixture binding'],
  ['seed/community/request_destroy.ex:store:update', 'store destroy command in fixture binding'],
])

/** Detect direct and aliased internal Commands/Queries and non-allowlisted writes. */
export function fixtureBoundaryFindings(source, file) {
  const findings = []
  const aliases = new Map()
  const domainAliases = new Set()
  const repoAliases = new Set(['Repo'])
  const lines = source.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*alias\s+([\w.]+)(?:,\s*as:\s*(\w+))?\s*(?:#.*)?$/)
    if (match && /(?:^|\.)Repo$/.test(match[1]))
      repoAliases.add(match[2] || 'Repo')
    if (match && /(?:^|\.)CMS\.(?:Communities|Articles|Passport\.Catalog|Gate)(?:\.|$)/.test(match[1]))
      domainAliases.add(match[2] || match[1].split('.').at(-1))
    if (!match || !/(?:^|\.)(?:Commands|Query)(?:\.|$)/.test(match[1])) continue
    aliases.set(match[2] || match[1].split('.').at(-1), match[1])
  }
  let currentFunction = ''
  lines.forEach((line, index) => {
    const code = line.replace(/#.*/, '')
    const definition = code.match(/^\s*defp?\s+([a-z_][a-z0-9_!?]*)\b/)
    if (definition) currentFunction = definition[1]
    if (/^\s*(?:alias|import|require)\b/.test(code)) return
    if (/\b(?:[A-Z]\w*\.)*(?:Commands|Query)\.[A-Z_a-z]\w*/.test(code))
      findings.push({ line: index + 1, message: 'internal Command or Query call' })
    if (/\b(?:GroupherServer\.)?CMS\.(?:Communities|Articles)\.[a-z_]\w*\s*\(/.test(code))
      findings.push({ line: index + 1, message: 'internal domain call' })
    if (/\b(?:GroupherServer\.)?CMS\.(?:Passport\.Catalog|Gate)\.[a-z_]\w*\s*\(/.test(code))
      findings.push({ line: index + 1, message: 'internal validation or admission call' })
    for (const alias of aliases.keys()) {
      if (new RegExp(`(?<![\\w.])${alias}\\.[a-zA-Z_]\\w*(?=\\s*(?:\\(|\\s))`).test(code))
        findings.push({ line: index + 1, message: `aliased internal module ${alias}` })
    }
    for (const alias of domainAliases) {
      if (aliases.has(alias)) continue
      if (new RegExp(`(?<![\\w.])${alias}\\.[a-z_]\\w*(?=\\s*(?:\\(|\\s))`).test(code))
        findings.push({ line: index + 1, message: `aliased internal domain ${alias}` })
    }
    for (const alias of repoAliases) {
      const write = code.match(
        new RegExp(`(?<![\\w.])${alias}\\.(insert_all|update_all|delete_all|insert|update|delete)!?(?=\\s*(?:\\(|\\s))`),
      )
      if (write && !writes.has(`${file}:${currentFunction}:${write[1]}`))
        findings.push({ line: index + 1, message: `unapproved Repo.${write[1]} write` })
    }
  })
  return findings
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seedFiles = (directory) =>
    readdirSync(path.join(root, fixtureRoot, directory), { withFileTypes: true }).flatMap((entry) => {
      const name = path.join(directory, entry.name)
      return entry.isDirectory() ? seedFiles(name) : entry.isFile() && name.endsWith('.ex') ? [name] : []
    })
  const files = [...fixtureFiles, ...seedFiles('seed')]
  const findings = files.flatMap((file) =>
    fixtureBoundaryFindings(readFileSync(path.join(root, fixtureRoot, file), 'utf8'), file).map(
      (finding) => ({ ...finding, file: path.join(fixtureRoot, file) }),
    ),
  )
  if (findings.length) {
    console.error(
      findings.map(({ file, line, message }) => `${file}:${line}: ${message}`).join('\n'),
    )
    process.exit(1)
  }
  console.log(`Development fixture boundary checked across ${files.length} files.`)
}
