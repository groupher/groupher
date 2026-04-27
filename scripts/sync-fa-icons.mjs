import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const sourceDir = path.join(repoRoot, 'frontend/core/assets/fa')
const allowedApps = ['main', 'dashboard', 'landing']
const requestedApps = process.argv.slice(2)
const targetApps = requestedApps.length > 0 ? requestedApps : allowedApps

if (!existsSync(sourceDir)) {
  throw new Error(`FA icon source directory not found: ${sourceDir}`)
}

for (const app of targetApps) {
  if (!allowedApps.includes(app)) {
    throw new Error(
      `Unsupported target app "${app}". Allowed values: ${allowedApps.join(', ')}`,
    )
  }

  const targetDir = path.join(repoRoot, `frontend/${app}/public/icons/fa`)

  mkdirSync(path.dirname(targetDir), { recursive: true })

  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true })
  }

  mkdirSync(targetDir, { recursive: true })
  cpSync(sourceDir, targetDir, { recursive: true })

  const fileCount = readdirSync(targetDir).length
  console.log(`[sync-fa-icons] synced ${fileCount} files -> frontend/${app}/public/icons/fa`)
}
