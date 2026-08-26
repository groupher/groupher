import { access, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const landingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientRoot = path.join(landingRoot, 'dist/client')

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
