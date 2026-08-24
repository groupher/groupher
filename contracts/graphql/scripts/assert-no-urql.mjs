import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const frontend = join(root, 'frontend')
const forbidden = ["from 'urql'", 'from "urql"', '@urql/', 'GraphQLProvider', 'useGraphQLClient']
const sourceExtensions = new Set(['.ts', '.tsx'])
const violations = []

const scan = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (!sourceExtensions.has(extname(entry.name))) continue

    const content = await readFile(path, 'utf8')
    for (const token of forbidden) {
      if (content.includes(token)) violations.push(`${relative(root, path)}: ${token}`)
    }
  }
}

await scan(frontend)

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
for (const name of ['urql', '@urql/core', '@urql/exchange-retry', '@urql/next']) {
  if (pkg.dependencies?.[name] || pkg.devDependencies?.[name]) {
    violations.push(`package.json: ${name}`)
  }
}

if (violations.length > 0) {
  console.error(`urql migration gate failed:\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('urql migration gate passed')
}
