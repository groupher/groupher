import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const generated = path.join(root, 'frontend/core/lib/graphql/generated/graphql.ts')
const source = fs.readFileSync(generated, 'utf8')
const codegenSource = fs.readFileSync(path.join(root, 'codegen.ts'), 'utf8')
const documentPaths = [...codegenSource.matchAll(/'([^']+\.(?:ts|tsx))'/g)].map(
  ([, filePath]) => filePath,
)

const requiredMarkers = [
  'export type UserQueryVariables',
  'export type UserQuery',
  'export const UserDocument',
  'export type SessionStateQueryVariables',
  'export type SessionStateQuery',
  'export const SessionStateDocument',
]

const missing = requiredMarkers.filter((marker) => !source.includes(marker))
if (missing.length) {
  throw new Error(`Generated GraphQL smoke check failed; missing: ${missing.join(', ')}`)
}

const operationMarkers = []
const fragmentMarkers = []
const capitalize = (name) => name.replace(/^./, (character) => character.toUpperCase())

for (const relativePath of documentPaths) {
  const documentSource = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const graphqlDocuments = [...documentSource.matchAll(/\bgraphql\(\s*`([\s\S]*?)`\s*\)/g)].map(
    ([, document]) => document,
  )

  for (const graphqlDocument of graphqlDocuments) {
    for (const [, kind, name] of graphqlDocument.matchAll(
      /\b(query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    )) {
      const suffix = kind[0].toUpperCase() + kind.slice(1)
      operationMarkers.push(`export type ${capitalize(name)}${suffix}`)
      operationMarkers.push(`export type ${capitalize(name)}${suffix}Variables`)
      operationMarkers.push(`export const ${capitalize(name)}Document`)
    }
    for (const [, name] of graphqlDocument.matchAll(
      /\bfragment\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\b/g,
    )) {
      fragmentMarkers.push(`export type ${name}Fragment`)
      fragmentMarkers.push(`export const ${name}FragmentDoc`)
    }
  }
}

const allMissing = [...new Set([...operationMarkers, ...fragmentMarkers])].filter(
  (marker) => !source.includes(marker),
)
if (allMissing.length) {
  throw new Error(
    `Generated GraphQL operation coverage failed; missing ${allMissing.length} markers:\n- ${allMissing.join('\n- ')}`,
  )
}

console.log(`Generated GraphQL smoke check passed (${documentPaths.length} source files)`)
