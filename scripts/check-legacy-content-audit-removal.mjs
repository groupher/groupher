import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const roots = [
  'backend/api/lib',
  'backend/api/config',
  'backend/api/schema.graphql',
  'frontend/core',
  'packages/contracts',
]

const ignoredDirectories = new Set(['node_modules', '.next', 'dist', 'build', '_build'])
const sourceExtensions = new Set([
  '.ex',
  '.exs',
  '.graphql',
  '.heex',
  '.js',
  '.jsx',
  '.json',
  '.mjs',
  '.ts',
  '.tsx',
])

const v2ReportCountOwners = new Set([
  'backend/api/lib/groupher_server/alert_wall/persist.ex',
  'backend/api/lib/groupher_server/alert_wall/query.ex',
  'backend/api/lib/groupher_server/alert_wall.ex',
  'backend/api/lib/groupher_server/cms/review/results.ex',
  'backend/api/lib/groupher_server_web/resolvers/alert_wall.ex',
  'backend/api/lib/groupher_server_web/schema/account/account_types.ex',
  'backend/api/lib/groupher_server_web/schema/alert_wall/types.ex',
])
const reportCountPattern = /reported_count|report_count/

const legacyPatterns = [
  /AuditBot/,
  /audition/,
  /audit_failed/,
  /moderation_state/,
  /illegal_reason|illegal_words|illegal_articles|illegal_comments/,
  /has_illegal_[a-z_]+/,
  /is_legal|isLegal|illegalReason|illegalWords/,
  /IllegalWarning|IllegalBar/,
  /set_illegal|unset_illegal|set_audit_failed/,
  /(?:Article|Comment)\.pending/,
  /reportComment|undoReportComment|reportPost|undoReportPost/,
  /pagedAbuseReports|paged_abuse_reports|AbuseReport/,
  /reported_user_ids|viewer_has_reported|viewerHasReported/,
  /fold_for_report|report_threshold_for_fold/,
]

const walk = async (entry) => {
  const absolute = path.resolve(entry)
  let fileStat
  try {
    fileStat = await stat(absolute)
  } catch {
    return []
  }

  if (fileStat.isFile()) return [absolute]

  const files = []
  for (const item of await readdir(absolute, { withFileTypes: true })) {
    if (item.isDirectory() && ignoredDirectories.has(item.name)) continue
    const child = path.join(absolute, item.name)
    if (item.isDirectory()) files.push(...(await walk(child)))
    else if (sourceExtensions.has(path.extname(item.name))) files.push(child)
  }
  return files
}

const files = [...new Set((await Promise.all(roots.map(walk))).flat())]
const findings = []

for (const file of files) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/)
  lines.forEach((line, index) => {
    const relativeFile = path.relative(process.cwd(), file)
    const activePatterns = v2ReportCountOwners.has(relativeFile)
      ? legacyPatterns
      : [...legacyPatterns, reportCountPattern]
    if (activePatterns.some((pattern) => pattern.test(line))) {
      findings.push(`${relativeFile}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (findings.length) {
  console.error(`Legacy content Audit/Report runtime references remain (${findings.length}):`)
  console.error(findings.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Legacy content Audit/Report runtime scan passed (${files.length} source files).`)
}
