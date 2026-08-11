import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const codegenPath = path.join(repoRoot, 'codegen.ts')
const codegenSource = fs.readFileSync(codegenPath, 'utf8')
const documentPaths = [...codegenSource.matchAll(/'([^']+\.(?:ts|tsx))'/g)].map(
  ([, filePath]) => filePath,
)
const documentPathSet = new Set(documentPaths)

const failures = []

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolutePath)
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return []
    if (entry.name.includes('.test.')) return []
    return [absolutePath]
  })

for (const relativePath of documentPaths) {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: Codegen document path does not exist`)
    continue
  }

  const source = fs.readFileSync(absolutePath, 'utf8')
  if (/\bgql\s*`/.test(source)) {
    failures.push(`${relativePath}: legacy gql template is not allowed in the Codegen set`)
  }
  if (/\bgraphql\s*\(\s*`[^`]*\$\{/s.test(source)) {
    failures.push(`${relativePath}: graphql() document contains runtime interpolation`)
  }
}

for (const absolutePath of [
  ...walk(path.join(repoRoot, 'frontend/core/schemas')),
  ...walk(path.join(repoRoot, 'frontend/core/unit')),
]) {
  const source = fs.readFileSync(absolutePath, 'utf8')
  if (!/from\s+['"]~\/graphql\/authoring['"]/.test(source)) continue

  const relativePath = path.relative(repoRoot, absolutePath)
  if (!documentPathSet.has(relativePath)) {
    failures.push(`${relativePath}: authoring document is missing from codegen.ts`)
  }
}

if (failures.length) {
  console.error(`Static GraphQL source check failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`Static GraphQL source check passed (${documentPaths.length} files)`)
}
