import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const widgetRoot = resolve(import.meta.dirname, '..')
const distPath = resolve(widgetRoot, 'dist')
const loaderPath = resolve(distPath, 'v1.js')
const manifestPath = resolve(distPath, '.vite/manifest.json')

await access(resolve(distPath, 'demo/index.html'))
const [loader, manifestSource] = await Promise.all([
  readFile(loaderPath, 'utf8'),
  readFile(manifestPath, 'utf8'),
])
const manifest = JSON.parse(manifestSource)
const runtime = manifest['src/main.ts']
const loaderEntry = manifest['src/loader/index.ts']

if (loader.includes('import.meta')) {
  throw new Error('The stable Widget loader must remain compatible with classic scripts.')
}
if (loader.includes('widget-runtime.00000000.js')) {
  throw new Error('The stable Widget loader contains an unresolved runtime asset placeholder.')
}
if (loaderEntry?.file !== 'v1.js' || !runtime?.file?.startsWith('assets/widget-runtime.')) {
  throw new Error('The Widget manifest does not contain the expected loader and runtime entries.')
}

console.log(`Verified classic loader ${loaderEntry.file} -> ${runtime.file}`)
