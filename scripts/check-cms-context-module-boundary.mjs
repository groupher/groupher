import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsRoot = path.join(repoRoot, 'backend', 'api', 'lib', 'groupher_server', 'cms')

const sourceFilePattern = /\.ex$/
const sharedFacadeFiles = new Set([
  'article_stats.ex',
  'command.ex',
  'front_desk.ex',
  'gate.ex',
  'outbox.ex',
])
// These maintenance Commands are the single transaction owner for their operation.
const approvedTransactionOwners = new Set([
  'backend/api/lib/groupher_server/cms/artiment_mentions/commands/hide_source.ex',
  'backend/api/lib/groupher_server/cms/artiment_mentions/commands/rebuild_current_set.ex',
])

/** Collects CMS source files without including generated or ignored artifacts. */
export const cmsSourceFiles = (root = cmsRoot) => {
  const entries = readdirSync(root, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) return cmsSourceFiles(absolute)
    return entry.isFile() && sourceFilePattern.test(entry.name) ? [absolute] : []
  })
}

/** Masks Elixir comments and strings while preserving line numbers for findings. */
export const maskElixir = (source) => {
  const chars = [...source]
  let state = 'code'
  let quote = ''
  let heredoc = false

  const blank = (index) => {
    if (chars[index] !== '\n') chars[index] = ' '
  }

  const maskSigil = (start) => {
    const interpolates = chars[start + 1] === chars[start + 1]?.toLowerCase()
    const opener = chars[start + 2]
    if (!opener) return start

    const paired = new Map([
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
      ['<', '>'],
    ])
    const closer = paired.get(opener) ?? opener
    const triple = chars[start + 3] === opener && chars[start + 4] === opener
    let depth = paired.has(opener) ? 1 : 0
    let cursor = start

    for (; cursor <= start + (triple ? 4 : 2); cursor += 1) blank(cursor)

    for (; cursor < chars.length; cursor += 1) {
      const current = chars[cursor]
      blank(cursor)

      if (current === '\\') {
        blank(cursor + 1)
        cursor += 1
        continue
      }

      if (triple) {
        if (interpolates && current === '#' && chars[cursor + 1] === '{') {
          cursor = maskInterpolation(cursor)
          continue
        }
        if (current === closer && chars[cursor + 1] === closer && chars[cursor + 2] === closer) {
          blank(cursor + 1)
          blank(cursor + 2)
          return cursor + 2
        }
        continue
      }

      if (interpolates && current === '#' && chars[cursor + 1] === '{') {
        cursor = maskInterpolation(cursor)
        continue
      }

      if (paired.has(opener) && current === opener) depth += 1
      if (current !== closer) continue
      if (!paired.has(opener) || --depth === 0) return cursor
    }

    return cursor
  }

  const maskInterpolation = (start) => {
    let depth = 0
    let interpolationQuote = null

    for (let cursor = start; cursor < chars.length; cursor += 1) {
      const current = chars[cursor]
      blank(cursor)

      if (interpolationQuote) {
        if (current === '\\') {
          blank(cursor + 1)
          cursor += 1
        } else if (current === interpolationQuote) {
          interpolationQuote = null
        }
        continue
      }

      if (current === '"' || current === "'") {
        interpolationQuote = current
        continue
      }
      if (current === '{') depth += 1
      if (current === '}' && --depth === 0) return cursor
    }

    return chars.length - 1
  }

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index]
    const next = chars[index + 1]
    const third = chars[index + 2]

    if (state === 'comment') {
      blank(index)
      if (current === '\n') state = 'code'
      continue
    }

    if (state === 'string') {
      blank(index)
      if (current === '\\') {
        blank(index + 1)
        index += 1
      } else if (
        heredoc ? current === quote && next === quote && third === quote : current === quote
      ) {
        if (heredoc) {
          blank(index + 1)
          blank(index + 2)
          index += 2
        }
        state = 'code'
      }
      continue
    }

    if (current === '#') {
      blank(index)
      state = 'comment'
      continue
    }

    if (current === '~' && /[A-Za-z]/.test(next ?? '') && chars[index + 2]) {
      index = maskSigil(index)
      continue
    }

    if ((current === '"' || current === "'") && next === current && third === current) {
      blank(index)
      blank(index + 1)
      blank(index + 2)
      index += 2
      quote = current
      heredoc = true
      state = 'string'
      continue
    }

    if (current === '"' || current === "'") {
      blank(index)
      quote = current
      heredoc = false
      state = 'string'
    }
  }

  return chars.join('')
}

const ownerForPath = (relativePath) => {
  const parts = relativePath.split('/')
  const file = parts.at(-1)
  const contextPath = parts.slice(0, -1)
  const context = contextPath[contextPath.indexOf('cms') + 1] ?? 'cms'

  // The generic pipeline adapter is infrastructure glue. It may own the
  // independent rejection-audit transaction on behalf of the runner, but it
  // is not a CMS business facade or Command implementation.
  if (file === 'command_pipeline_adapter.ex') return 'pipeline_adapter'
  if (parts.length === 6 && sharedFacadeFiles.has(file)) return 'shared'
  if (parts.length === 6 && file.endsWith('.ex')) return 'facade'
  if (contextPath.includes('commands')) return 'commands'
  if (contextPath.includes('reactions')) return 'commands'
  if (contextPath.includes('jobs') || file.endsWith('_job.ex')) return 'workflow/job'
  if (
    contextPath.includes('workflows') ||
    file === 'workflow.ex' ||
    contextPath.includes('workflow')
  ) {
    return 'workflow'
  }
  if (file === 'persist.ex' || file.endsWith('_persist.ex')) return 'persist'
  if (file === 'effects.ex' || contextPath.includes('effects')) return 'effects'
  if (file === 'lifecycle.ex' || contextPath.includes('lifecycle')) return 'lifecycle'
  if (file.includes('writer') || contextPath.includes('writer')) return 'writer'
  if (file === 'mutation.ex' || contextPath.includes('mutation')) return 'mutation'
  return 'other'
}

const finding = (relativePath, line, category, message, source) => ({
  path: relativePath,
  line,
  category,
  message,
  source: source.trim(),
})

/** Returns P0 boundary findings for one CMS source file. */
export const boundaryFindings = (source, relativePath) => {
  const masked = maskElixir(source)
  const owner = ownerForPath(relativePath)
  const findings = []
  const transactionCount = masked.match(/\bRepo\.transaction\s*\(/g)?.length ?? 0

  if (owner === 'persist' && !/\b(?:def|defp|defmacro|defmacrop|defdelegate)\s/.test(masked)) {
    findings.push(
      finding(
        relativePath,
        1,
        'empty_persist',
        'Persist is empty; remove the placeholder or add a real row primitive',
        source.split('\n')[0] ?? '',
      ),
    )
  }

  masked.split('\n').forEach((line, index) => {
    const lineNumber = index + 1

    if (/\bRepo\.transaction\s*\(/.test(line) && owner === 'persist') {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'persist_transaction',
          'Persist owns a transaction; move transaction ownership to Command or Workflow',
          line,
        ),
      )
    }

    if (
      /\bRepo\.transaction\s*\(/.test(line) &&
      ['commands', 'writer', 'mutation', 'facade'].includes(owner) &&
      !(approvedTransactionOwners.has(relativePath) && transactionCount === 1)
    ) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'transaction_owner',
          `${owner} owns a transaction; verify that this is the single Command or Workflow owner`,
          line,
        ),
      )
    }

    if (/\b(?:CMS\.)?Outbox\.(?:send|insert|enqueue)\s*\(/.test(line)) {
      if (owner === 'commands' || owner === 'writer' || owner === 'mutation') {
        findings.push(
          finding(
            relativePath,
            lineNumber,
            'direct_outbox',
            `${owner} calls CMS.Outbox directly; route the effect through the context Effects owner`,
            line,
          ),
        )
      }
    }

    if (
      owner === 'commands' &&
      /\b(?:[A-Z][A-Za-z0-9_]*\.)?Writer\.[a-z_][A-Za-z0-9_]*\s*\(/.test(line)
    ) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'command_writer',
          'Command calls Writer directly; migrate the write primitive to Persist/Lifecycle/Workflow',
          line,
        ),
      )
    }

    if (
      owner === 'commands' &&
      relativePath.includes('/cms/comments/commands/') &&
      /\b(?:ORM|Repo)\.(?:create|insert|insert_all|update|update_all|delete|delete_all|inc|update_embed)\s*\(/.test(
        line,
      )
    ) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'comment_command_row_write',
          'Comments Commands must route Comment row writes through Comments.Persist',
          line,
        ),
      )
    }

    if (owner === 'persist' && /\bdefdelegate\b.*\bWorkflow\b/.test(line)) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'persist_workflow_delegate',
          'Persist delegates to Workflow; keep row primitives in Persist and orchestration in the caller',
          line,
        ),
      )
    }

    if (
      relativePath.includes('/cms/interactions/reactions/') &&
      /\bRepo\.(?:insert_all|delete_all|insert|update|delete)\s*\(/.test(line)
    ) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'reaction_repo_write',
          'Reaction writes must go through Interactions.Persist',
          line,
        ),
      )
    }

    const workflowUserAction =
      (relativePath.includes('/cms/community_applications/workflow.ex') &&
        /\bdef\s+(?:submit|cancel)\s*\(/.test(line)) ||
      (relativePath.includes('/cms/comments/workflow.ex') &&
        /\bdef\s+(?:create|reply)\s*\(/.test(line)) ||
      (relativePath.includes('/cms/wallpaper/workflow.ex') &&
        /\bdef\s+(?:publish|restore_snapshot)\s*\(/.test(line))

    if (owner === 'workflow' && workflowUserAction) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'workflow_user_command',
          'User mutation belongs to Commands; Workflow may only own multi-stage, retryable, or maintenance work',
          line,
        ),
      )
    }

    if (
      owner === 'workflow/job' &&
      /\b(?:[A-Z][A-Za-z0-9_]*\.)?Commands\.[A-Z][A-Za-z0-9_]*\.execute\s*\(/.test(line)
    ) {
      findings.push(
        finding(
          relativePath,
          lineNumber,
          'job_user_command',
          'Job calls a user Command; resume a named Workflow or Effects delivery instead',
          line,
        ),
      )
    }
  })

  return findings
}

/** Scans the current CMS tree and returns findings grouped by source file. */
export const cmsContextBoundaryFindings = (root = cmsRoot) =>
  cmsSourceFiles(root).flatMap((absolute) => {
    const relativePath = path.relative(repoRoot, absolute)
    return boundaryFindings(readFileSync(absolute, 'utf8'), relativePath)
  })

const categoryOrder = [
  'empty_persist',
  'persist_workflow_delegate',
  'reaction_repo_write',
  'workflow_user_command',
  'persist_transaction',
  'transaction_owner',
  'direct_outbox',
  'command_writer',
  'job_user_command',
]

const formatFindings = (findings) => {
  const grouped = new Map(categoryOrder.map((category) => [category, []]))
  findings.forEach((item) => grouped.get(item.category)?.push(item))

  return categoryOrder.flatMap((category) => {
    const items = grouped.get(category)
    if (!items?.length) return []
    return [
      `${category} (${items.length})`,
      ...items.map((item) => `- ${item.path}:${item.line}: ${item.message}: ${item.source}`),
    ]
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = cmsContextBoundaryFindings()
  const report = formatFindings(findings)

  console.log(`CMS context module boundary report: ${findings.length} findings`)
  if (report.length > 0) console.log(report.join('\n'))
  const strict = process.argv.includes('--strict')
  console.log(
    strict
      ? 'Strict CMS context module boundary check.'
      : 'This is a report-only P0 inventory; existing findings are migration debt until their owner is migrated.',
  )
  if (strict && findings.length > 0) process.exitCode = 1
}
