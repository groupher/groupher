import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { maskElixir } from './check-cms-context-module-boundary.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'backend/api/lib')

// These modules own an external-client deadline, a background-job deadline, or
// an intentionally longer maintenance/receipt transaction. Keep exceptions exact.
export const infrastructureTimeoutOwners = new Map([
  ['groupher_server/analysis/web/config.ex', 'Umami HTTP client configuration'],
  ['groupher_server/analysis/web/provider/umami.ex', 'Umami HTTP client'],
  ['groupher_server/cms/assets/provider_deletion.ex', 'asset provider HTTP client'],
  ['groupher_server/cms/search_artiments/algolia.ex', 'Algolia HTTP client'],
  ['groupher_server/public_cache/delivery_config.ex', 'cache delivery HTTP client configuration'],
  ['groupher_server/public_cache/cloudflare.ex', 'Cloudflare HTTP client'],
  ['groupher_server/cms/command/receipt/runner.ex', 'receipt transaction owner'],
  ['groupher_server/cms/wallpaper/workflow.ex', 'publish lease and transaction owner'],
  ['groupher_server/cms/production_seed/content.ex', 'one-time production seed'],
  ['groupher_server/cms/production_seed/references.ex', 'one-time production seed'],
  ['groupher_server/cms/production_seed/cleanup.ex', 'one-time production seed'],
  ['groupher_server/cms/seeds/full_community.ex', 'development seed cleanup'],
  ['groupher_server/accounts/profile_view_tracker/config.ex', 'background dedupe cleanup limits'],
  ['groupher_server/accounts/profile_view_tracker/dedupe_cleanup.ex', 'background dedupe cleanup'],
  ['groupher_server/cms/view_tracker/config.ex', 'background dedupe cleanup limits'],
  ['groupher_server/cms/view_tracker/view_dedupe_cleanup.ex', 'background dedupe cleanup'],
  ['helper/orm/transaction_settings.ex', 'database transaction settings adapter'],
])

const prohibited = /\b\w*timeout_ms\b|\b\w*budget(?:_ms)?\b|\btimeout\s*:/g

/** Reports execution-control parameters in an ordinary backend business module. */
export function timeoutBoundaryFindings(source, relativePath) {
  if (infrastructureTimeoutOwners.has(relativePath)) return []

  const masked = maskElixir(source)
  const lines = masked.split('\n')
  const sourceLines = source.split('\n')
  return lines.flatMap((line, index) => {
    prohibited.lastIndex = 0
    return prohibited.test(line)
      ? [{ file: relativePath, line: index + 1, source: sourceLines[index].trim() }]
      : []
  })
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory()
      ? sourceFiles(filename)
      : entry.isFile() && filename.endsWith('.ex')
        ? [filename]
        : []
  })
}

/** Scans every backend source module for unclassified execution controls. */
export function scanBackendTimeoutBoundary(directory = sourceRoot) {
  return sourceFiles(directory).flatMap((filename) =>
    timeoutBoundaryFindings(readFileSync(filename, 'utf8'), path.relative(directory, filename)),
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = scanBackendTimeoutBoundary()
  if (findings.length > 0) {
    console.error('Backend timeout boundary violations:')
    for (const { file, line, source } of findings) {
      console.error(`- backend/api/lib/${file}:${line}: ${source}`)
    }
    process.exitCode = 1
  } else {
    console.log(
      `Backend timeout boundary is clean; ${infrastructureTimeoutOwners.size} exact infrastructure owners classified.`,
    )
  }
}
