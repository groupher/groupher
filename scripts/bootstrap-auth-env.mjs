import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const targetPath = path.join(root, 'frontend/auth/.env.local')
const sourcePaths = [
  path.join(root, 'frontend/main/.env.local'),
  path.join(root, 'frontend/main/.env.development.local'),
]
const requiredKeys = [
  'AUTH_GITHUB_ID',
  'AUTH_GITHUB_SECRET',
  'NEXTAUTH_SECRET',
  'GROUPHER_SERVER_TRUST_SECRET',
]

const parseEnv = (source) => {
  const values = new Map()

  for (const line of source.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    values.set(line.slice(0, separator), line.slice(separator + 1))
  }

  return values
}

const values = new Map()
for (const sourcePath of sourcePaths) {
  try {
    const source = await readFile(sourcePath, 'utf8')
    for (const [key, value] of parseEnv(source)) {
      if (requiredKeys.includes(key) && value) values.set(key, value)
    }
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause
  }
}

const missingKeys = requiredKeys.filter((key) => !values.get(key))
if (missingKeys.length) {
  throw new Error(`Missing local Auth values: ${missingKeys.join(', ')}`)
}

const content = `${requiredKeys.map((key) => `${key}=${values.get(key)}`).join('\n')}\n`
await writeFile(targetPath, content, { encoding: 'utf8', mode: 0o600 })
await chmod(targetPath, 0o600)
console.log('Bootstrapped frontend/auth/.env.local from existing ignored local Auth values.')
