/**
 * Adapts Vitepress sources into the canonical Docs import tree.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, sourcePathForRoute, type TDocumentMetadata } from '../documentFile'
import { asRecord, linkNode, pageNode, scopeNode, sectionNode, slugify } from '../helpers'
import { parseStaticConfig } from '../staticConfig'

const CONFIG = /(^|\/)\.vitepress\/config\.(?:[cm]?[jt]s)$/

const titleize = (value: string): string =>
  value
    .replace(/^\/+|\/+$/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (x) => x.toUpperCase())

const sidebarItems = (
  items: unknown,
  scopeId: string,
  root: string,
  documents: Map<string, TDocumentMetadata>,
  inheritedBase = '',
): TSourceNode[] =>
  (Array.isArray(items) ? items : []).flatMap((value): TSourceNode[] => {
    const item = asRecord(value)
    if (!item) return []
    const text = typeof item.text === 'string' ? item.text : 'Untitled'
    const base = typeof item.base === 'string' ? item.base : inheritedBase
    if (Array.isArray(item.items)) {
      return [
        sectionNode(
          `sidebar:${scopeId}:${slugify(text)}`,
          text,
          sidebarItems(item.items, scopeId, root, documents, base),
        ),
      ]
    }
    if (typeof item.link !== 'string') return []
    if (/^https?:\/\//.test(item.link)) return [linkNode(text, item.link)]
    const route = item.link.startsWith('/')
      ? item.link
      : `${base || scopeId}${item.link}`.replace(/\/+/g, '/')
    const sourcePath = sourcePathForRoute(route, root, documents)
    const document = sourcePath ? documents.get(sourcePath) : undefined
    return document ? [{ ...pageNode(document, text), route }] : []
  })

const referencedSourcePaths = (nodes: TSourceNode[]): Set<string> => {
  const paths = new Set<string>()
  const visit = (node: TSourceNode): void => {
    if (node.type === 'page') paths.add(node.sourcePath)
    if (node.type === 'scope' || node.type === 'section') {
      for (const child of node.pages) visit(child)
    }
  }

  for (const node of nodes) visit(node)
  return paths
}

/** Maps VitePress scopes, sidebars, links, and unlisted pages into SourceTree.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export const analyzeVitePress = async (workspace: TSourceWorkspace): Promise<TSourceTree> => {
  const configPaths = workspace.files.map((file) => file.path).filter((file) => CONFIG.test(file))
  const baseRoot = configPaths[0]?.startsWith('.vitepress/')
    ? ''
    : configPaths[0]?.split('/.vitepress/')[0] || 'docs'
  const root =
    workspace.files.some((file) => file.path.startsWith(`${baseRoot}/en/`)) &&
    !workspace.files.some((file) => /^docs\/(guide|reference)\//.test(file.path))
      ? `${baseRoot}/en`
      : baseRoot
  const documents = await loadDocuments(workspace, root)
  const navigation: TSourceNode[] = []

  for (const configPath of [
    ...configPaths,
    ...workspace.files
      .map((file) => file.path)
      .filter(
        (file) =>
          (baseRoot ? file.startsWith(`${baseRoot}/`) : file.startsWith('.vitepress/')) &&
          (/config\.(?:[cm]?[jt]s)$/.test(file) || file.includes('.vitepress/config/')) &&
          !CONFIG.test(file),
      ),
  ]) {
    const config = asRecord(parseStaticConfig(await workspace.readText(configPath), configPath))
    const themeConfig = asRecord(config?.themeConfig)
    const rawSidebar =
      themeConfig?.sidebar ??
      config?.sidebar ??
      (configPath === configPaths[0] ? undefined : config)
    if (Array.isArray(rawSidebar)) {
      navigation.push(
        scopeNode(
          'sidebar:docs',
          typeof config?.title === 'string' ? config.title : 'Docs',
          '/',
          sidebarItems(rawSidebar, '/', root, documents, '/'),
        ),
      )
      continue
    }
    const sidebar = asRecord(rawSidebar)
    for (const [scopeId, rawItems] of Object.entries(sidebar ?? {})) {
      const definition = asRecord(rawItems)
      const items = definition?.items ?? rawItems
      const base = typeof definition?.base === 'string' ? definition.base : scopeId
      navigation.push(
        scopeNode(
          `sidebar:${scopeId}`,
          titleize(scopeId),
          scopeId,
          sidebarItems(items, scopeId, root, documents, base),
        ),
      )
    }
  }

  const referenced = referencedSourcePaths(navigation)
  const unlistedPages = Array.from(documents.values())
    .filter((document) => !referenced.has(document.sourcePath))
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((document) => pageNode(document, undefined, { navigationStatus: 'unlisted' }))

  if (unlistedPages.length > 0) {
    const unlistedSection = sectionNode('sidebar:unlisted', 'Other pages', unlistedPages)
    const firstScope = navigation[0]
    if (firstScope?.type === 'scope') {
      navigation[0] = { ...firstScope, pages: [...firstScope.pages, unlistedSection] }
    } else {
      navigation.push(scopeNode('sidebar:docs', 'Docs', '/', [unlistedSection]))
    }
  }

  return {
    navigation,
    schemaVersion: 2,
    source: { configPaths, framework: 'vitepress', root },
  }
}
