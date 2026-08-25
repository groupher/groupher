import { access, cp, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const landingRoot = path.resolve(scriptDir, '..')
const outDir = path.join(landingRoot, 'out')
const sourceNextDir = path.join(outDir, '_next')
const prefixedNextDir = path.join(outDir, 'landing', '_next')
const tempPrefixedNextDir = path.join(outDir, 'landing', '_next.tmp')

try {
  await access(sourceNextDir)
} catch {
  throw new Error('Expected Next.js assets at out/_next before preparing Worker Static Assets.')
}

await mkdir(path.dirname(prefixedNextDir), { recursive: true })
await rm(tempPrefixedNextDir, { force: true, recursive: true })
await cp(sourceNextDir, tempPrefixedNextDir, { recursive: true })
await rm(prefixedNextDir, { force: true, recursive: true })
await rename(tempPrefixedNextDir, prefixedNextDir)
await rm(sourceNextDir, { force: true, recursive: true })
console.log('Prepared Worker Static Assets at out/landing/_next')
