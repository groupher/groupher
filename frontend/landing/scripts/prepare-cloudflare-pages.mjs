import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const landingRoot = path.resolve(scriptDir, '..')
const outDir = path.join(landingRoot, 'out')
const sourceNextDir = path.join(outDir, '_next')
const prefixedNextDir = path.join(outDir, 'landing', '_next')

await mkdir(path.dirname(prefixedNextDir), { recursive: true })
await rm(prefixedNextDir, { force: true, recursive: true })
await cp(sourceNextDir, prefixedNextDir, { recursive: true })
await rm(sourceNextDir, { force: true, recursive: true })

console.log('Prepared Cloudflare Pages assets at out/landing/_next')
