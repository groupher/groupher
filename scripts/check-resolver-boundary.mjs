import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resolverRoot = path.join(
  repoRoot,
  'backend',
  'api',
  'lib',
  'groupher_server_web',
  'resolvers',
)

const collectElixirFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectElixirFiles(absolute)
    return entry.name.endsWith('.ex') ? [absolute] : []
  })

/** Reports forbidden persistence and internal-domain dependencies in resolver source. */
export const resolverBoundaryFindings = (source) => {
  const findings = []
  const rules = [
    ['Ecto.Query is forbidden', /\b(?:import|alias|require)\s+Ecto\.Query\b|\bEcto\.Query\b/],
    ['Repo access is forbidden', /\b(?:GroupherServer\.)?Repo\b|\bRepo\.[a-z_]/],
    ['Helper.ORM is forbidden', /\bHelper\.ORM\b|\bORM\.[a-z_]/],
    [
      'domain implementation modules are forbidden',
      /\b(?:CMS|Accounts|Analysis|Activity)\.[A-Z][A-Za-z0-9_.]*\.(?:Store|Writer|Commands|Query)\b/,
    ],
    ['Map.from_struct leaks persistence shape', /\bMap\.from_struct\s*\(/],
    [
      'partial schema construction is forbidden',
      /%(?:[A-Z][A-Za-z0-9_.]*\.)?(?:User|Community|Category|Article|Comment|CommunityTag|CommunityTagGroup)\s*\{\s*[a-z_]+\s*:/,
    ],
  ]

  source.split('\n').forEach((line, index) => {
    const code = line.replace(/#.*/, '')
    for (const [message, pattern] of rules) {
      if (pattern.test(code)) findings.push({ line: index + 1, message, source: line.trim() })
    }
  })

  return findings
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = collectElixirFiles(resolverRoot).flatMap((absolute) =>
    resolverBoundaryFindings(readFileSync(absolute, 'utf8')).map((finding) => ({
      ...finding,
      file: path.relative(repoRoot, absolute),
    })),
  )

  if (violations.length > 0) {
    console.error(
      `Resolver boundary violations found:\n${violations
        .map(({ file, line, message, source }) => `- ${file}:${line}: ${message}: ${source}`)
        .join('\n')}`,
    )
    process.exit(1)
  }

  console.log('Resolver boundary is clean across the complete resolver directory.')
}
