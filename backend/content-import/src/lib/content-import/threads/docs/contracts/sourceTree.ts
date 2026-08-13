/**
 * Canonical recursive source-navigation contract, independent of Groupher DB ids.
 *
 *   framework adapter -> SourceTree -> Preview artifact -> Phoenix Docs tree plan
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import {
  array,
  ContractError,
  integer,
  literal,
  oneOf,
  optionalBoolean,
  optionalString,
  record,
  string,
} from './decoder'

export const SOURCE_TREE_SCHEMA_VERSION = 2 as const

export type TSourcePage = {
  draft?: boolean
  type: 'page'
  navigationStatus?: 'unlisted'
  route: string
  sizeBytes?: number
  sourceId: string
  sourcePath: string
  title: string
}

export type TSourceLink = {
  href: string
  type: 'link'
  sourceId: string
  title: string
}

export type TSourceSection = {
  pages: TSourceNode[]
  type: 'section'
  sourceId: string
  title: string
}

export type TSourceScope = {
  pages: TSourceNode[]
  type: 'scope'
  routePrefix?: string
  sourceId: string
  title: string
}

export type TSourceNode = TSourceLink | TSourcePage | TSourceSection | TSourceScope

export type TSourceTree = {
  navigation: TSourceNode[]
  schemaVersion: typeof SOURCE_TREE_SCHEMA_VERSION
  source: {
    configPaths: string[]
    framework: string
    root: string
  }
}

export type TSourceTreeLimits = {
  maxDepth?: number
  maxNodes?: number
}

const decodeNode = (
  value: unknown,
  path: string,
  depth: number,
  state: { count: number; maxDepth: number; maxNodes: number },
): TSourceNode => {
  if (depth > state.maxDepth) throw new ContractError(path, `exceeds depth ${state.maxDepth}`)
  state.count += 1
  if (state.count > state.maxNodes) throw new ContractError(path, `exceeds ${state.maxNodes} nodes`)

  const input = record(value, path)
  const type = string(input.type, `${path}.type`, 16)
  const common = {
    sourceId: string(input.sourceId, `${path}.sourceId`, 1_024),
    title: string(input.title, `${path}.title`, 512),
  }

  if (type === 'page') {
    return {
      ...common,
      draft: optionalBoolean(input.draft, `${path}.draft`),
      type,
      navigationStatus:
        input.navigationStatus == null
          ? undefined
          : oneOf(input.navigationStatus, ['unlisted'] as const, `${path}.navigationStatus`),
      route: string(input.route, `${path}.route`, 1_024),
      sizeBytes:
        input.sizeBytes == null ? undefined : integer(input.sizeBytes, `${path}.sizeBytes`),
      sourcePath: string(input.sourcePath, `${path}.sourcePath`, 1_024),
    }
  }
  if (type === 'link') {
    return { ...common, href: string(input.href, `${path}.href`, 2_048), type }
  }
  if (type !== 'scope' && type !== 'section') {
    throw new ContractError(`${path}.type`, 'expected scope, section, page, or link')
  }

  const pages = array(input.pages, `${path}.pages`).map((child, index) =>
    decodeNode(child, `${path}.pages[${index}]`, depth + 1, state),
  )

  return type === 'scope'
    ? {
        ...common,
        pages,
        type,
        routePrefix: optionalString(input.routePrefix, `${path}.routePrefix`, 1_024),
      }
    : { ...common, pages, type }
}

/** Decodes SourceTree while enforcing total-node, depth, and text-size limits. */
export const decodeSourceTree = (value: unknown, limits: TSourceTreeLimits = {}): TSourceTree => {
  const input = record(value, 'sourceTree')
  const source = record(input.source, 'sourceTree.source')
  const configPaths = array(source.configPaths, 'sourceTree.source.configPaths')
  if (configPaths.length > 100) {
    throw new ContractError('sourceTree.source.configPaths', 'exceeds 100 paths')
  }
  const state = {
    count: 0,
    maxDepth: limits.maxDepth ?? 32,
    maxNodes: limits.maxNodes ?? 10_000,
  }

  return {
    navigation: array(input.navigation, 'sourceTree.navigation').map((node, index) =>
      decodeNode(node, `sourceTree.navigation[${index}]`, 1, state),
    ),
    schemaVersion: literal(
      input.schemaVersion,
      SOURCE_TREE_SCHEMA_VERSION,
      'sourceTree.schemaVersion',
    ),
    source: {
      configPaths: configPaths.map((item, index) =>
        string(item, `sourceTree.source.configPaths[${index}]`, 1_024),
      ),
      framework: string(source.framework, 'sourceTree.source.framework', 64),
      root: string(source.root, 'sourceTree.source.root', 1_024),
    },
  }
}
