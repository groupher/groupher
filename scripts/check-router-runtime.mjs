import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REQUIRED_VERSION = '1.170.21'
const packages = [
  ['frontend/core/package.json', ['peerDependencies', 'devDependencies']],
  ['frontend/landing/package.json', ['dependencies']],
  ['frontend/community/package.json', ['dependencies']],
  ['frontend/dash/package.json', ['dependencies']],
  ['frontend/apply/package.json', ['dependencies']],
  ['frontend/inspire-me/package.json', ['dependencies']],
]

export const collectResolvedRouterVersions = (lockfile) =>
  new Set(
    [
      ...lockfile.matchAll(
        /^\s{2}'?@tanstack\/react-router@(\d+\.\d+\.\d+)/gm,
      ),
    ].map(([, version]) => version),
  )

const main = async () => {
  const packageJson = async (relativePath) =>
    JSON.parse(await readFile(resolve(relativePath), 'utf8'))

  const failures = []
  for (const [relativePath, sections] of packages) {
    const manifest = await packageJson(relativePath)
    for (const section of sections) {
      const declared = manifest[section]?.['@tanstack/react-router']
      if (declared !== REQUIRED_VERSION) {
        failures.push(
          `${relativePath} ${section} must pin @tanstack/react-router to ${REQUIRED_VERSION}`,
        )
      }
    }
  }

  const lockfile = await readFile(resolve('pnpm-lock.yaml'), 'utf8')
  const resolvedVersions = collectResolvedRouterVersions(lockfile)

  if (resolvedVersions.size !== 1 || !resolvedVersions.has(REQUIRED_VERSION)) {
    failures.push(
      `pnpm-lock.yaml must resolve one @tanstack/react-router version (${REQUIRED_VERSION}); found ${
        [...resolvedVersions].join(', ') || 'none'
      }`,
    )
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log(`@tanstack/react-router runtime is pinned to ${REQUIRED_VERSION}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
