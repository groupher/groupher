#!/usr/bin/env node

// Report candidate references for the Docs queue cutover. Matches are evidence
// for review, not proof that the referenced code belongs to Docs.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout
}

const roots = [
  'backend/api/lib',
  'backend/api/config',
  'backend/api/priv/repo/migrations',
  'backend/api/scripts',
  'backend/api/test',
  'frontend',
  'packages',
  'docs/import',
  'scripts',
]

const categories = [
  ['branch', String.raw`DocBranch|doc_branch|branch_id|branchId|target_branch|branch_policy`],
  ['queue', String.raw`docPublishChecklist|doc_publish_checklist|Publish\.Checklist|Publish\.Selection|expected_checklist_revision|site_draft_version|staged_event_count|DocsSiteState`],
  ['publication', String.raw`DocDraft|DocRevision|DocPublic|DocPublishRelease|DocTreeSnapshot|PublishRequest|publish_requests`],
  ['cross_domain', String.raw`DocReviewBlock|DocLifecycle|DocCover|DocTreeEvent|DocTreeNode|DocBranchVersion`],
]

const report = {
  version: 1,
  purpose: 'Candidate references requiring B0 classification; not a violation list',
  generated_at: new Date().toISOString(),
  git_head: git(['rev-parse', 'HEAD']).trim(),
  git_branch: git(['branch', '--show-current']).trim(),
  worktree_status_sha256: createHash('sha256')
    .update(git(['status', '--porcelain=v1', '-z', '--untracked-files=all']))
    .digest('hex'),
  roots,
  categories: {},
}
const fileHashes = new Map()

for (const [name, pattern] of categories) {
  const result = spawnSync(
    'rg',
    ['--json', '--no-ignore', '--glob', '!node_modules/**', '--glob', '!**/node_modules/**',
      '--glob', '!**/_build/**', '--glob', '!**/deps/**', '--glob', '!**/.next/**',
      '-e', pattern, ...roots],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )

  if (result.status !== 0 && result.status !== 1) {
    process.stderr.write(result.stderr || `rg failed for ${name}\n`)
    process.exit(1)
  }

  const files = new Map()
  for (const line of result.stdout.split('\n')) {
    if (!line) continue
    const event = JSON.parse(line)
    if (event.type !== 'match') continue
    const path = event.data.path.text ?? Buffer.from(event.data.path.bytes, 'base64').toString('utf8')
    const text = event.data.lines.text ?? Buffer.from(event.data.lines.bytes, 'base64').toString('utf8')
    if (!fileHashes.has(path)) {
      fileHashes.set(path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex'))
    }
    const matches = files.get(path) ?? []
    matches.push({
      line: event.data.line_number,
      text: text.trimEnd(),
    })
    files.set(path, matches)
  }

  report.categories[name] = {
    file_count: files.size,
    match_count: [...files.values()].reduce((count, matches) => count + matches.length, 0),
    files: Object.fromEntries([...files.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }
}

report.file_sha256 = Object.fromEntries([...fileHashes.entries()].sort(([a], [b]) => a.localeCompare(b)))
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
