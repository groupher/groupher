import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendRoot = path.join(repoRoot, 'frontend')
const allowed = path.join('frontend', 'core', 'query', 'invalidation', 'executor.ts')

const collect = (directory) => {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', '.next'].includes(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collect(absolute))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

const violations = collect(frontendRoot).flatMap((absolute) => {
  const relative = path.relative(repoRoot, absolute)
  if (relative === allowed) return []
  const source = readFileSync(absolute, 'utf8')
  return /\binvalidateQueries\s*\(/.test(source) ? [relative] : []
})

if (violations.length > 0) {
  console.error(
    `Direct TanStack invalidation is only allowed in ${allowed}:\n${violations
      .map((file) => `- ${file}`)
      .join('\n')}`,
  )
  process.exit(1)
}

console.log('Query invalidation boundary is clean.')
