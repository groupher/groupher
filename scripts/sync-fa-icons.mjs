import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const sourceDir = path.join(repoRoot, 'frontend/core/assets/icons')
const allowedApps = ['main', 'dashboard', 'landing']
const allowedProviders = ['fa', 'lucide', 'heroicons', 'phosphor']
const requestedApps = process.argv.slice(2)
const targetApps = requestedApps.length > 0 ? requestedApps : allowedApps

if (!existsSync(sourceDir)) {
  throw new Error(`Icon source directory not found: ${sourceDir}`)
}

for (const app of targetApps) {
  if (!allowedApps.includes(app)) {
    throw new Error(
      `Unsupported target app "${app}". Allowed values: ${allowedApps.join(', ')}`,
    )
  }

  const targetRoot = path.join(repoRoot, `frontend/${app}/public/icons`)
  mkdirSync(targetRoot, { recursive: true })

  for (const provider of allowedProviders) {
    const sourceProviderDir = path.join(sourceDir, provider)
    const targetProviderDir = path.join(targetRoot, provider)

    if (!existsSync(sourceProviderDir)) continue

    if (existsSync(targetProviderDir)) {
      rmSync(targetProviderDir, { recursive: true, force: true })
    }

    mkdirSync(targetProviderDir, { recursive: true })
    cpSync(sourceProviderDir, targetProviderDir, { recursive: true })

    const fileCount = readdirSync(targetProviderDir).length
    console.log(
      `[sync-fa-icons] synced ${fileCount} files -> frontend/${app}/public/icons/${provider}`,
    )
  }
}
