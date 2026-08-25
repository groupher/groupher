import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const manifestPath = path.join(repoRoot, 'contracts/graphql/exception-manifest.json')
const mockSchemaPath = path.join(repoRoot, 'frontend/mock-server/schema.graphql')
const backendSchemaPath = path.join(repoRoot, 'backend/api/schema.graphql')

const fail = (message) => {
  console.error(`GraphQL contract check failed: ${message}`)
  process.exitCode = 1
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (!manifest || !Array.isArray(manifest.exceptions)) {
  fail('exception manifest must contain an exceptions array')
}

const issuePattern = /(?:https?:\/\/[^\s/]+\/[^\s/]+\/issues\/\d+|#\d+)/
const expiryPattern = /^\d{4}-\d{2}-\d{2}$/
const today = new Date().toISOString().slice(0, 10)
const ids = new Set()

for (const exception of manifest.exceptions ?? []) {
  const { id, owner, reason, issue, expires } = exception ?? {}
  if (!id || ids.has(id)) fail(`exception id is missing or duplicated: ${id ?? '<unknown>'}`)
  ids.add(id)
  if (!owner) fail(`${id}: owner is required`)
  if (!reason) fail(`${id}: reason is required`)
  if (typeof issue !== 'string' || !issuePattern.test(issue)) {
    fail(`${id}: issue must match an issue URL or #number`)
  }
  if (typeof expires !== 'string' || !expiryPattern.test(expires)) {
    fail(`${id}: expires must be an ISO date`)
  } else if (expires < today) {
    fail(`${id}: exception expired on ${expires}`)
  }
}

const mockStat = fs.lstatSync(mockSchemaPath)
if (!mockStat.isSymbolicLink()) fail('frontend/mock-server/schema.graphql must be a symlink')

if (fs.realpathSync(mockSchemaPath) !== fs.realpathSync(backendSchemaPath)) {
  fail('mock schema must resolve to backend/api/schema.graphql')
}

if (!process.exitCode) {
  console.log('GraphQL repository contract invariants passed')
}
