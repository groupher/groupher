import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const assetsRoot = path.join(repoRoot, 'frontend/core/assets/icons')
const optimizedSourceDir = path.join(assetsRoot, 'generated/optimized')
const spriteSourceDir = path.join(assetsRoot, 'generated/sprites')
const providerLogoSourceDir = path.join(assetsRoot, 'raw/providers')
const providers = ['fa', 'lucide', 'heroicons', 'phosphor']
const allowedApps = ['main', 'dashboard', 'landing']
const requestedApps = process.argv.slice(2)
const targetApps = requestedApps.length > 0 ? requestedApps : allowedApps

const runGenerate = () => {
  console.log('[sync-fa-icons] Generating source icons because optimized assets are missing.')

  const result = spawnSync('yarn', ['generate:fa-icons'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error('Failed to generate icon assets, run `yarn generate:fa-icons` manually')
  }
}

if (!existsSync(optimizedSourceDir) || !existsSync(spriteSourceDir)) {
  runGenerate()
}

if (!existsSync(optimizedSourceDir)) {
  throw new Error(`Optimized icon source directory not found: ${optimizedSourceDir}`)
}

if (!existsSync(spriteSourceDir)) {
  throw new Error(`Icon sprite source directory not found: ${spriteSourceDir}`)
}

for (const app of targetApps) {
  if (!allowedApps.includes(app)) {
    throw new Error(
      `Unsupported target app "${app}". Allowed values: ${allowedApps.join(', ')}`,
    )
  }

  const targetRoot = path.join(repoRoot, `frontend/${app}/public/icons`)
  mkdirSync(targetRoot, { recursive: true })

  for (const entry of readdirSync(targetRoot)) {
    const fullPath = path.join(targetRoot, entry)
    if (entry.endsWith('.sprite.svg') || providers.includes(entry)) {
      rmSync(fullPath, { recursive: true, force: true })
    }
  }

  for (const provider of providers) {
    cpSync(path.join(optimizedSourceDir, provider), path.join(targetRoot, provider), {
      recursive: true,
    })
  }

  const spriteFiles = readdirSync(spriteSourceDir).filter((file) => file.endsWith('.sprite.svg'))
  for (const file of spriteFiles) {
    cpSync(path.join(spriteSourceDir, file), path.join(targetRoot, file))
  }

  if (existsSync(providerLogoSourceDir)) {
    const targetProviderDir = path.join(targetRoot, 'providers')
    rmSync(targetProviderDir, { recursive: true, force: true })
    mkdirSync(targetProviderDir, { recursive: true })
    cpSync(providerLogoSourceDir, targetProviderDir, { recursive: true })
  }

  console.log(
    `[sync-fa-icons] synced ${providers.length} icon dirs and ${spriteFiles.length} sprites -> frontend/${app}/public/icons`,
  )
}
