#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const contractRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(contractRoot, 'schemas/v1.schema.json')
const fixturesDir = path.join(contractRoot, 'fixtures')

const loadJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

const schema = await loadJson(schemaPath)
const allowedTopLevelKeys = new Set(Object.keys(schema.properties))
const requiredTopLevelKeys = schema.required
const allowedStatuses = new Set(schema.properties.status.enum)
const allowedServices = new Set(schema.properties.service.enum)
const allowedCheckKeys = new Set(Object.keys(schema.$defs.check.properties))

const fail = (message) => {
  throw new Error(message)
}

const assertString = (value, pathName) => {
  if (typeof value !== 'string' || value.length === 0) fail(`${pathName} must be a non-empty string`)
}

const assertStatus = (value, pathName) => {
  assertString(value, pathName)
  if (!allowedStatuses.has(value)) fail(`${pathName} must be one of ${[...allowedStatuses].join(', ')}`)
}

const assertTimestamp = (value) => {
  assertString(value, 'timestamp')
  if (!Number.isFinite(Date.parse(value))) fail('timestamp must be a valid date-time string')
}

const assertHealth = (payload, expectedService) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('health response must be an object')
  }

  for (const key of requiredTopLevelKeys) {
    if (!(key in payload)) fail(`missing required field: ${key}`)
  }

  for (const key of Object.keys(payload)) {
    if (!allowedTopLevelKeys.has(key)) fail(`unknown field: ${key}`)
  }

  if (payload.schemaVersion !== 'health.v1') fail('schemaVersion must be health.v1')
  assertStatus(payload.status, 'status')
  assertString(payload.service, 'service')
  if (!allowedServices.has(payload.service)) fail(`unknown service: ${payload.service}`)
  if (expectedService && payload.service !== expectedService) {
    fail(`service must be ${expectedService}, got ${payload.service}`)
  }
  assertString(payload.version, 'version')
  assertString(payload.environment, 'environment')
  assertTimestamp(payload.timestamp)

  if (!Number.isInteger(payload.uptimeMs) || payload.uptimeMs < 0) {
    fail('uptimeMs must be a non-negative integer')
  }

  if (!Array.isArray(payload.checks)) fail('checks must be an array')
  payload.checks.forEach((check, index) => {
    const pathName = `checks[${index}]`
    if (!check || typeof check !== 'object' || Array.isArray(check)) fail(`${pathName} must be an object`)
    for (const key of Object.keys(check)) {
      if (!allowedCheckKeys.has(key)) fail(`${pathName}.${key} is not allowed`)
    }
    assertString(check.name, `${pathName}.name`)
    assertStatus(check.status, `${pathName}.status`)
    if ('latencyMs' in check && (typeof check.latencyMs !== 'number' || check.latencyMs < 0)) {
      fail(`${pathName}.latencyMs must be a non-negative number`)
    }
    if ('message' in check) assertString(check.message, `${pathName}.message`)
  })
}

const args = process.argv.slice(2)
const urlArgIndex = args.indexOf('--url')
const serviceArgIndex = args.indexOf('--service')
const url = urlArgIndex >= 0 ? args[urlArgIndex + 1] : undefined
const expectedService = serviceArgIndex >= 0 ? args[serviceArgIndex + 1] : undefined

if (urlArgIndex >= 0 && !url) fail('--url requires a URL')
if (serviceArgIndex >= 0 && !expectedService) fail('--service requires a service id')

if (url) {
  const response = await fetch(url)
  if (![200, 503].includes(response.status)) fail(`unexpected status code: ${response.status}`)
  assertHealth(await response.json(), expectedService)
  console.log(`ok ${url}`)
} else {
  const fixtureNames = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json')).sort()
  for (const fixtureName of fixtureNames) {
    assertHealth(await loadJson(path.join(fixturesDir, fixtureName)))
    console.log(`ok fixtures/${fixtureName}`)
  }
}
