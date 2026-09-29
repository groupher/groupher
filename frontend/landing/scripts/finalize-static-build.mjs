import { access, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const landingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Finds Landing's static assets from Cloudflare worker metadata, independent of output version names. */
const resolveClientRoot = async () => {
  const outputRoot = path.join(landingRoot, '.cloudflare/output')
  const outputEntries = await readdir(outputRoot, { recursive: true, withFileTypes: true })
  const candidates = []

  for (const entry of outputEntries) {
    if (!entry.isFile() || entry.name !== 'worker.config.json') continue

    const workerRoot = entry.parentPath
    const config = JSON.parse(await readFile(path.join(workerRoot, entry.name), 'utf8'))
    if (config.name !== 'landing' || config.assets === undefined) continue

    const assetsRoot = path.join(workerRoot, 'assets')
    await access(assetsRoot)
    candidates.push(assetsRoot)
  }

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one Landing assets output under ${outputRoot}, found ${candidates.length}`,
    )
  }

  return candidates[0]
}

const clientRoot = await resolveClientRoot()

const entries = await readdir(clientRoot, { recursive: true, withFileTypes: true })
const htmlFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => path.join(entry.parentPath, entry.name))
const cssFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  .map((entry) => path.join(entry.parentPath, entry.name))

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8')
  const namespacedHtml = html.replaceAll('/assets/', '/landing/assets/')
  if (namespacedHtml.includes('_next') || /(?:href|src)="\/assets\//.test(namespacedHtml)) {
    throw new Error(`Legacy or unowned asset path remains in ${htmlFile}`)
  }

  const assetReferences = [
    ...new Set(
      [
        ...namespacedHtml.matchAll(/(?:href|src)="(\/landing\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g),
      ].map(([, reference]) => reference),
    ),
  ]
  if (assetReferences.length === 0) {
    throw new Error(`No Landing bundle assets found in ${htmlFile}`)
  }

  const assetsRoot = path.resolve(clientRoot, 'assets')
  for (const reference of assetReferences) {
    const relativeAssetPath = decodeURIComponent(reference.slice('/landing/assets/'.length))
    const assetPath = path.resolve(assetsRoot, relativeAssetPath)
    if (assetPath !== assetsRoot && !assetPath.startsWith(`${assetsRoot}${path.sep}`)) {
      throw new Error(`Landing asset escapes the bundle directory: ${reference}`)
    }
    await access(assetPath).catch(() => {
      throw new Error(`Landing asset is missing from the Cloudflare assets output: ${reference}`)
    })
  }

  await writeFile(htmlFile, namespacedHtml)
}

for (const cssFile of cssFiles) {
  const css = await readFile(cssFile, 'utf8')
  if (/url\(["']?\/assets\//.test(css)) {
    throw new Error(`CSS contains an unnamespaced root asset URL: ${cssFile}`)
  }
}

const expectedPages = new Map([
  ['index.html', 'data-testid="landing-page"'],
  ['pricing/index.html', 'data-testid="pricing-page"'],
  ['book-demo/index.html', '<title>Groupher | Keep your team and users aligned</title>'],
  ['404/index.html', 'data-testid="not-found-page"'],
])

for (const [relativePath, marker] of expectedPages) {
  const html = await readFile(path.join(clientRoot, relativePath), 'utf8')
  if (!html.includes(marker) || !html.includes('/landing/assets/')) {
    throw new Error(`Prerendered page is incomplete: ${relativePath}`)
  }
}

const notFoundDirectory = path.join(clientRoot, '404')
const notFoundOutput = path.join(clientRoot, '404.html')
await rename(path.join(notFoundDirectory, 'index.html'), notFoundOutput)
await rm(notFoundDirectory, { recursive: true })

const notFoundHtml = await readFile(notFoundOutput, 'utf8')
if (!notFoundHtml.includes('data-testid="not-found-page"')) {
  throw new Error('Production output must contain the branded 404.html')
}

for (const healthArtifact of ['health', 'health.html']) {
  await access(path.join(clientRoot, healthArtifact)).then(
    () => {
      throw new Error(`Production output must not contain ${healthArtifact}`)
    },
    () => undefined,
  )
}

console.log(`[landing] verified ${expectedPages.size} prerendered pages and asset namespace`)
