import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

import type {
  TServiceConfigContent,
  TServiceConfigFile,
  TServiceConfigFileGroup,
  TServiceConfigKind,
  TServiceConfigManifest,
} from '../shared/contracts.ts'
import { REPO_ROOT, type TServiceConfigDefinition, type TServiceDefinition } from './services.ts'

const MAX_CONFIG_FILE_BYTES = 64 * 1024
const REDACTED_VALUE = '••••••'

type TResolvedConfigFile = TServiceConfigFile & {
  absolutePath: string
  sortOrder: number
}

type TConfigClassification = {
  group: TServiceConfigFileGroup
  active: boolean
  sensitive: boolean
  sortOrder: number
}

export class ServiceConfigError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

export class ServiceConfigReader {
  private readonly definitions = new Map<string, TServiceDefinition>()

  constructor(
    definitions: TServiceDefinition[],
    private readonly repoRoot: string = REPO_ROOT,
  ) {
    for (const definition of definitions) this.definitions.set(definition.id, definition)
  }

  async getManifest(serviceId: string): Promise<TServiceConfigManifest> {
    const definition = this.getDefinition(serviceId)
    const files = await this.discoverFiles(definition)

    return {
      serviceId,
      serviceName: definition.name,
      kind: definition.config?.kind || 'none',
      environment:
        definition.config?.kind === 'python-settings'
          ? null
          : definition.config?.environment || null,
      environmentKeys:
        definition.config?.kind === 'python-settings' ? [...definition.config.environmentKeys] : [],
      files: files.map(({ absolutePath: _absolutePath, sortOrder: _sortOrder, ...file }) => file),
    }
  }

  async getContent(
    serviceId: string,
    fileId: string,
    reveal: boolean,
  ): Promise<TServiceConfigContent> {
    const definition = this.getDefinition(serviceId)
    const file = (await this.discoverFiles(definition)).find((candidate) => candidate.id === fileId)
    if (!file)
      throw new ServiceConfigError(`Unknown configuration file for ${definition.name}.`, 404)

    const metadata = await lstat(file.absolutePath)
    if (!metadata.isFile()) {
      throw new ServiceConfigError(`Configuration file is no longer available: ${file.name}`, 404)
    }
    if (metadata.size > MAX_CONFIG_FILE_BYTES) {
      throw new ServiceConfigError(
        `${file.name} is larger than the ${MAX_CONFIG_FILE_BYTES / 1024} KB viewer limit.`,
        409,
      )
    }

    const source = await readFile(file.absolutePath, 'utf8')
    const redacted = file.sensitive && !reveal

    return {
      serviceId,
      fileId,
      content: redacted ? redactContent(source, definition.config?.kind || 'none') : source,
      redacted,
    }
  }

  private getDefinition(serviceId: string): TServiceDefinition {
    const definition = this.definitions.get(serviceId)
    if (!definition) throw new ServiceConfigError(`Unknown service: ${serviceId}`, 404)
    return definition
  }

  private async discoverFiles(definition: TServiceDefinition): Promise<TResolvedConfigFile[]> {
    const config = definition.config
    if (!config) return []

    const root = await resolveConfigRoot(config, this.repoRoot)
    if (!root) return []
    const names = await listConfigNames(config, root)
    const files = await Promise.all(
      names.map(async (name): Promise<TResolvedConfigFile | null> => {
        const absolutePath = path.resolve(root, name)
        if (!isWithin(root, absolutePath)) return null

        const metadata = await lstat(absolutePath).catch(() => null)
        if (!metadata?.isFile() || metadata.isSymbolicLink()) return null

        const resolvedPath = await realpath(absolutePath).catch(() => null)
        if (!resolvedPath || !isWithin(root, resolvedPath)) return null

        const classification = classifyConfigFile(config, name)
        const relativePath = path.relative(this.repoRoot, resolvedPath).split(path.sep).join('/')

        return {
          id: Buffer.from(relativePath).toString('base64url'),
          name,
          path: relativePath,
          sizeBytes: metadata.size,
          modifiedAt: metadata.mtimeMs,
          absolutePath: resolvedPath,
          ...classification,
        }
      }),
    )

    return files
      .filter((file): file is TResolvedConfigFile => file !== null)
      .sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      )
  }
}

async function resolveConfigRoot(
  config: TServiceConfigDefinition,
  repoRootPath: string,
): Promise<string | null> {
  const [repoRoot, configRoot] = await Promise.all([
    realpath(repoRootPath),
    realpath(config.root).catch(() => null),
  ])
  if (!configRoot) return null
  if (!isWithin(repoRoot, configRoot)) {
    throw new ServiceConfigError('Service configuration root must stay inside the repository.', 409)
  }
  return configRoot
}

async function listConfigNames(config: TServiceConfigDefinition, root: string): Promise<string[]> {
  if (config.kind === 'python-settings') return [...config.files]

  const entries = await readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) =>
      config.kind === 'next-env'
        ? name === '.env' || name.startsWith('.env.')
        : name.endsWith('.exs'),
    )
}

function classifyConfigFile(config: TServiceConfigDefinition, name: string): TConfigClassification {
  if (config.kind === 'next-env') {
    const activeOrder = [
      `.env.${config.environment}.local`,
      '.env.local',
      `.env.${config.environment}`,
      '.env',
    ]
    const activeIndex = activeOrder.indexOf(name)
    if (activeIndex >= 0) {
      return { group: 'active', active: true, sensitive: true, sortOrder: activeIndex }
    }
    if (name.endsWith('.example')) {
      return { group: 'template', active: false, sensitive: false, sortOrder: 200 }
    }
    return { group: 'other', active: false, sensitive: true, sortOrder: 100 }
  }

  if (config.kind === 'elixir-config') {
    const activeOrder = [
      'config.exs',
      `${config.environment}.exs`,
      `${config.environment}.secret.exs`,
      'runtime.exs',
    ]
    const activeIndex = activeOrder.indexOf(name)
    return {
      group: activeIndex >= 0 ? 'active' : 'other',
      active: activeIndex >= 0,
      sensitive: name.endsWith('.secret.exs'),
      sortOrder: activeIndex >= 0 ? activeIndex : 100,
    }
  }

  return { group: 'active', active: true, sensitive: false, sortOrder: 0 }
}

function redactContent(content: string, kind: TServiceConfigKind): string {
  const lines = content.split(/\r?\n/)
  if (kind === 'next-env') {
    return lines
      .map((line) =>
        line.replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*).*$/, `$1${REDACTED_VALUE}`),
      )
      .join('\n')
  }

  return lines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return line
      return `${line.match(/^\s*/)?.[0] || ''}# ${REDACTED_VALUE}`
    })
    .join('\n')
}

function isWithin(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`)
}
