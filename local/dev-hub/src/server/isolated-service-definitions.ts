import path from 'node:path'

import {
  databaseTargetForEnvironment,
  validateDatabaseTarget,
  type TDatabaseTarget,
} from './database-ownership.ts'
import type { TServiceDefinition } from './services.ts'

export const ISOLATED_CORE_SERVICE_IDS = new Set([
  'dev-gateway',
  'auth',
  'phoenix',
  'community',
  'dash',
  'assets-hub',
  'status',
])

/** Derive all local addresses from one registered checkout and its reserved ports. */
export function isolatedServiceDefinitions(
  definitions: TServiceDefinition[],
  slug: string,
  ports: Record<string, number>,
  database: TDatabaseTarget,
): TServiceDefinition[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || database.purpose !== 'dev')
    throw new Error('Invalid isolated environment identity.')
  validateDatabaseTarget(database)
  const expected = databaseTargetForEnvironment(
    { role: 'secondary', slug, worktreeId: database.worktreeId },
    'dev',
  )
  if (
    database.database !== expected.database ||
    database.hostname !== expected.hostname ||
    database.port !== expected.port
  )
    throw new Error('The isolated environment requires its own development database.')
  const portMapping = new Map<number, number>()
  const allocated = new Set<number>()
  for (const service of definitions) {
    if (!service.port) continue
    const target = ports[service.id]
    if (!Number.isInteger(target) || target < 1 || target > 65535 || allocated.has(target))
      throw new Error(`Missing or conflicting allocated port for ${service.id}.`)
    if (portMapping.has(service.port))
      throw new Error('Multiple services share an unmanaged source port.')
    portMapping.set(service.port, target)
    allocated.add(target)
  }
  const rewrite = (value: string) =>
    value
      .replace(/(?<![a-z0-9-])groupher\.localhost\b/g, `groupher-${slug}.localhost`)
      .replace(/\b(127\.0\.0\.1|localhost):(\d+)\b/g, (_match, host: string, raw: string) => {
        const port = portMapping.get(Number(raw))
        return port ? `${host}:${port}` : `${host}:${raw}`
      })
  const transform = (value: unknown): unknown => {
    if (typeof value === 'string') return rewrite(value)
    if (Array.isArray(value)) return value.map(transform)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, transform(entry)]),
      )
    return value
  }
  return definitions.map((source) => {
    const service = transform(source) as TServiceDefinition
    service.localEnvironment ||= {}
    service.localEnvironment.env ||= {}
    service.localEnvironment.env.DEV_HUB_PUBLIC_ROOT = `groupher-${slug}.localhost`
    if (service.localEnvironment.editableEnvKeys) {
      service.localEnvironment.editableEnvKeys = service.localEnvironment.editableEnvKeys.filter(
        (key) =>
          !['DB_NAME', 'DB_HOST', 'DB_PORT', 'MIX_BUILD_PATH', 'MIX_DEPS_PATH'].includes(key),
      )
    }
    if (service.localEnvironment.env.DB_NAME === 'groupher_server_dev') {
      Object.assign(service.localEnvironment.env, {
        DB_NAME: database.database,
        DB_HOST: database.hostname,
        DB_PORT: String(database.port),
      })
    }
    if (source.port) {
      service.port = portMapping.get(source.port)!
      service.localEnvironment.env.PORT = String(service.port)
    }
    for (let index = 0; index < (source.endpoints?.length || 0); index++) {
      const original = source.endpoints![index]
      if (original.port && service.endpoints?.[index])
        service.endpoints[index].port = portMapping.get(original.port) || original.port
    }
    if (service.id === 'phoenix') {
      if (!service.localEnvironment?.env) throw new Error('Phoenix local configuration is missing.')
      Object.assign(service.localEnvironment.env, {
        PORT: String(service.port),
        DB_NAME: database.database,
        DB_HOST: database.hostname,
        DB_PORT: String(database.port),
        MIX_BUILD_PATH: path.join(service.cwd, 'backend/api/_build'),
        MIX_DEPS_PATH: path.join(service.cwd, 'backend/api/deps'),
      })
      service.localEnvironment.externalEnvKeys = service.localEnvironment.externalEnvKeys?.filter(
        (key) => !key.startsWith('ALGOLIA_'),
      )
    }
    if (service.id === 'auth') {
      service.localEnvironment.env.AUTH_TEST_ALLOWED_ORIGINS = [
        `https://groupher-${slug}.localhost`,
        `https://community.groupher-${slug}.localhost`,
        `https://dash.groupher-${slug}.localhost`,
      ].join(',')
    }
    if (service.id === 'assets-hub') {
      service.localEnvironment.externalEnvKeys = service.localEnvironment.externalEnvKeys?.filter(
        (key) => !key.startsWith('ASSETS_R2_'),
      )
      Object.assign(service.localEnvironment.env, {
        ASSETS_R2_BUCKET: '',
        ASSETS_R2_REGION: '',
        ASSETS_R2_ENDPOINT: '',
      })
    }
    return service
  })
}
