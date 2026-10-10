import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsRoot = path.join(repoRoot, 'backend', 'api', 'lib', 'groupher_server', 'cms')

/** Canonical product facades covered by the focused Phase 2/3 audit. */
export const facadeFiles = [
  'articles.ex',
  'comments.ex',
  'communities.ex',
  'docs.ex',
  'kanban.ex',
  'assets.ex',
  'press.ex',
  'wallpaper.ex',
  'snapshot.ex',
  'front_desk.ex',
]

/** Concrete commands that must remain behind a product facade. */
export const commandFiles = [
  'docs/commands/update_draft.ex',
  'docs/commands/publish_branch.ex',
  'docs/commands/restore_revision_to_draft.ex',
  'kanban/commands/add.ex',
  'kanban/commands/move.ex',
  'kanban/commands/remove.ex',
  'kanban/commands/set_status.ex',
]

/** Reports persistence, effect, and shared-command dependencies in a facade source. */
export const facadeBoundaryFindings = (source) => {
  const findings = []
  const rules = [
    ['Repo access is forbidden in product facades', /\b(?:alias|import|require)\s+(?:GroupherServer\.)?Repo\b|\bRepo\.[a-z_]/],
    ['Ecto query/transaction access is forbidden in product facades', /\b(?:Ecto\.Query|Repo\.transaction|Ecto\.Multi)\b/],
    ['external effect access is forbidden in product facades', /\b(?:HTTPoison|Req|Tesla|Finch|Cachex|Nebulex)\b/],
    ['facades must not construct shared CMS commands', /%\s*(?:GroupherServer\.)?CMS\.Command\s*\{/],
  ]

  source.split('\n').forEach((line, index) => {
    const code = line.replace(/#.*/, '')
    for (const [message, pattern] of rules) {
      if (pattern.test(code)) findings.push({ line: index + 1, message, source: line.trim() })
    }
  })

  return findings
}

/** Verifies the command directory manifest and each command's public execute entrypoint. */
export const commandManifestFindings = (root = cmsRoot) => {
  const findings = []
  for (const relative of commandFiles) {
    const absolute = path.join(root, relative)
    if (!existsSync(absolute)) {
      findings.push({ file: relative, message: 'required concrete command is missing' })
      continue
    }

    const source = readFileSync(absolute, 'utf8')
    if (!/\bdef\s+execute\s*\(/.test(source)) {
      findings.push({ file: relative, message: 'concrete command must expose execute/...' })
    }
  }
  return findings
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = facadeFiles.flatMap((relative) => {
    const absolute = path.join(cmsRoot, relative)
    return facadeBoundaryFindings(readFileSync(absolute, 'utf8')).map((finding) => ({
      ...finding,
      file: path.join('backend/api/lib/groupher_server/cms', relative),
    }))
  })
  const manifestViolations = commandManifestFindings()

  if (violations.length > 0 || manifestViolations.length > 0) {
    const messages = [
      ...violations.map(({ file, line, message, source }) => `- ${file}:${line}: ${message}: ${source}`),
      ...manifestViolations.map(({ file, message }) => `- backend/api/lib/groupher_server/cms/${file}: ${message}`),
    ]
    console.error(`CMS facade boundary violations found:\n${messages.join('\n')}`)
    process.exit(1)
  }

  console.log(`CMS facade boundary is clean across ${facadeFiles.length} facades and ${commandFiles.length} commands.`)
}
