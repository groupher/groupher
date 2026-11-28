import { randomBytes } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseEnv } from 'node:util'

import type { TServiceEnvironment } from '../shared/contracts.ts'
import { ServiceConfigError } from './config-reader.ts'
import {
  assertLocalEnvironmentAllowed,
  localEnvironmentPaths,
  resolveLocalEnvironment,
  validateLocalEnvironmentState,
  withLocalEnvironmentLock,
  type TLocalEnvironmentState,
} from './local-environment.ts'
import { REPO_ROOT, type TServiceDefinition } from './services.ts'

const MAX_FILE_BYTES = 64 * 1024
const sensitive = (key: string) =>
  /SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|SIGNING|DATABASE_URL/.test(key)
const editableKeys = (definition: TServiceDefinition) =>
  new Set([
    ...(definition.localEnvironment?.editableEnvKeys || []),
    ...(definition.localEnvironment?.externalEnvKeys || []),
  ])

function serializeValue(value: string): string {
  // dotenv parsers do not decode JSON escapes. Choose a lossless delimiter.
  for (const quote of ["'", '`', '"']) {
    const candidate = `${quote}${value}${quote}`
    if (!value.includes(quote) && parseEnv(`VALUE=${candidate}`).VALUE === value) return candidate
  }
  throw new ServiceConfigError(
    'Local configuration contains a value that cannot be represented as dotenv.',
  )
}

export const serviceEnvironmentPath = (definition: TServiceDefinition, repoRoot = REPO_ROOT) =>
  path.join(localEnvironmentPaths(repoRoot).directory, `${definition.id}.env`)

function validateValues(
  definition: TServiceDefinition,
  values: Record<string, unknown>,
  allowResets = false,
): void {
  const allowed = editableKeys(definition)
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || /^(SERVICE_AUTH_|DEV_HUB_|PHX_JWT_SECRET|PORT$)/.test(key)) {
      throw new ServiceConfigError(`${definition.name}: ${key} is not an editable local setting.`)
    }
    if (allowResets && value === null) continue
    if (typeof value !== 'string' || value.length > 8192 || /[\r\n\0]/.test(value)) {
      throw new ServiceConfigError(`${definition.name}: ${key} must be a single-line value.`)
    }
    serializeValue(value)
    if (
      (key === 'DB_PORT' || key === 'DB_POOL_SIZE') &&
      (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    ) {
      throw new ServiceConfigError(
        `${definition.name}: ${key} must be an integer between 1 and 65535.`,
      )
    }
  }
}

/** Reads only Hub-owned overrides; application dotenv files are not a runtime source. */
export async function readServiceLocalEnvironment(
  definition: TServiceDefinition,
  repoRoot = REPO_ROOT,
): Promise<Record<string, string>> {
  const file = serviceEnvironmentPath(definition, repoRoot)
  const metadata = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!metadata) return {}
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAX_FILE_BYTES ||
    !(await realpath(file)).startsWith(`${await realpath(repoRoot)}${path.sep}`)
  ) {
    throw new ServiceConfigError('Invalid Hub local configuration file.', 409)
  }
  const values = parseEnv(await readFile(file, 'utf8')) as Record<string, string>
  validateValues(definition, values)
  return values
}

export class ServiceEnvironmentStore {
  private readonly definitions: Map<string, TServiceDefinition>

  constructor(
    definitions: TServiceDefinition[],
    private readonly repoRoot = REPO_ROOT,
  ) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]))
  }

  private definition(serviceId: string): TServiceDefinition {
    const definition = this.definitions.get(serviceId)
    if (!definition || !/^[a-z0-9][a-z0-9-]*$/.test(serviceId)) {
      throw new ServiceConfigError('Unknown local configuration service.', 404)
    }
    return definition
  }

  async get(serviceId: string): Promise<TServiceEnvironment> {
    assertLocalEnvironmentAllowed()
    const definition = this.definition(serviceId)
    const overrides = await readServiceLocalEnvironment(definition, this.repoRoot)
    const paths = localEnvironmentPaths(this.repoRoot)
    const stateSource = await readFile(paths.state, 'utf8').catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
      },
    )
    let resolved = { ...definition.env, ...definition.localEnvironment?.env }
    if (stateSource) {
      let state: TLocalEnvironmentState
      try {
        state = JSON.parse(stateSource) as TLocalEnvironmentState
      } catch {
        throw new ServiceConfigError('Hub identity state contains invalid JSON.', 409)
      }
      validateLocalEnvironmentState(state, await realpath(this.repoRoot), paths.state)
      resolved = { ...definition.env, ...resolveLocalEnvironment(serviceId, state, definition).env }
    }
    const allowed = editableKeys(definition)
    const managedSecrets = new Set(Object.keys(definition.localEnvironment?.secrets || {}))
    const keys = new Set([...Object.keys(resolved), ...allowed, ...managedSecrets])
    return {
      serviceId,
      filePath: path.relative(this.repoRoot, serviceEnvironmentPath(definition, this.repoRoot)),
      appliesOn: 'next-start',
      entries: [...keys].sort().map((key) => {
        const isSecret = sensitive(key) || managedSecrets.has(key)
        const value = overrides[key] ?? resolved[key]
        return {
          key,
          value: isSecret ? null : (value ?? null),
          configured: value !== undefined && value !== '',
          secret: isSecret,
          editable: allowed.has(key),
          source: Object.hasOwn(overrides, key) ? 'local' : allowed.has(key) ? 'default' : 'hub',
        }
      }),
    }
  }

  async update(serviceId: string, changes: unknown): Promise<TServiceEnvironment> {
    assertLocalEnvironmentAllowed()
    const definition = this.definition(serviceId)
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new ServiceConfigError('Local configuration changes must be an object.')
    }
    const entries = Object.entries(changes)
    // Validate resets as well as replacements; resets must not target managed keys.
    validateValues(definition, Object.fromEntries(entries), true)
    await withLocalEnvironmentLock(this.repoRoot, async () => {
      const values = await readServiceLocalEnvironment(definition, this.repoRoot)
      for (const [key, value] of entries) {
        if (value === null) delete values[key]
        else values[key] = value as string
      }
      const file = serviceEnvironmentPath(definition, this.repoRoot)
      const directory = path.dirname(file)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await chmod(directory, 0o700)
      const source = Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${serializeValue(value)}`)
        .join('\n')
        .concat('\n')
      if (Buffer.byteLength(source) > MAX_FILE_BYTES)
        throw new ServiceConfigError('Local configuration is too large.')
      const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`
      try {
        await writeFile(temporary, source, { flag: 'wx', mode: 0o600 })
        await rename(temporary, file)
      } finally {
        await rm(temporary, { force: true })
      }
    })
    return this.get(serviceId)
  }
}
