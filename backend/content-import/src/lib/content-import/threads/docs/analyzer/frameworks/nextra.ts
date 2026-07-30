import path from 'node:path'

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, type TDocumentMetadata } from '../documentFile'
import { asRecord, linkNode, pageNode, scopeNode, sectionNode } from '../helpers'
import { parseStaticConfig } from '../staticConfig'

const metaFile = (directory: string, workspace: TSourceWorkspace): string | undefined =>
  workspace.files
    .map((file) => file.path)
    .find(
      (file) => file.startsWith(`${directory}/_meta.`) || file === `${directory}/_meta.global.tsx`,
    )

const fileForKey = (
  directory: string,
  key: string,
  documents: Map<string, TDocumentMetadata>,
): TDocumentMetadata | undefined =>
  documents.get(`${directory}/${key}.md`) ??
  documents.get(`${directory}/${key}.mdx`) ??
  documents.get(`${directory}/${key}/page.mdx`) ??
  documents.get(`${directory}/${key}/index.mdx`)

const directoryItems = async (
  directory: string,
  workspace: TSourceWorkspace,
  documents: Map<string, TDocumentMetadata>,
): Promise<TSourceNode[]> => {
  const metadataPath = metaFile(directory, workspace)
  if (!metadataPath) {
    return Array.from(documents.values())
      .filter((document) => path.posix.dirname(document.sourcePath) === directory)
      .map((document) => pageNode(document))
  }
  const metadata = asRecord(parseStaticConfig(await workspace.readText(metadataPath), metadataPath))
  const result: TSourceNode[] = []
  for (const [key, rawValue] of Object.entries(metadata ?? {})) {
    const value = asRecord(rawValue)
    if (value?.type === 'separator') continue
    if (typeof value?.href === 'string') {
      result.push(linkNode(typeof value.title === 'string' ? value.title : key, value.href))
      continue
    }
    const document = fileForKey(directory, key, documents)
    const title =
      typeof rawValue === 'string'
        ? rawValue
        : typeof value?.title === 'string'
          ? value.title
          : document?.title || key
    if (document) result.push(pageNode(document, title || document.title))
    const childDirectory = `${directory}/${key}`
    if (workspace.files.some((file) => file.path.startsWith(`${childDirectory}/`))) {
      const children = await directoryItems(childDirectory, workspace, documents)
      if (children.length > 0) {
        result.push(sectionNode(`directory:${childDirectory}`, title || key, children))
      }
    }
  }
  return result
}

/** Maps Nextra pages/app-router metadata and directory ordering into SourceTree.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export const analyzeNextra = async (workspace: TSourceWorkspace): Promise<TSourceTree> => {
  const appRouter = workspace.files.some((file) => file.path === 'app/_meta.global.tsx')
  const root = appRouter ? 'app' : 'content'
  const rootMeta = appRouter ? 'app/_meta.global.tsx' : metaFile(root, workspace)!
  const documents = await loadDocuments(workspace, root)
  const metadata = asRecord(parseStaticConfig(await workspace.readText(rootMeta), rootMeta))
  const navigation = []

  for (const [key, rawValue] of Object.entries(metadata ?? {})) {
    const value = asRecord(rawValue)
    if (value?.display === 'hidden' || value?.type === 'menu') continue
    if (typeof value?.href === 'string') continue
    const directory = `${root}/${key}`
    const document = fileForKey(root, key, documents)
    const title = typeof value?.title === 'string' ? value.title : document?.title || key
    const children = value?.items
      ? await inlineItems(directory, value.items, documents)
      : await directoryItems(directory, workspace, documents)
    if (
      document &&
      !children.some((child) => child.type === 'page' && child.sourceId === document.sourcePath)
    ) {
      children.unshift(pageNode(document, title))
    }
    if (children.length > 0) {
      navigation.push(scopeNode(`directory:${directory}`, title, `/${key}/`, children))
    }
  }

  return {
    navigation,
    schemaVersion: 2,
    source: { configPaths: [rootMeta], framework: 'nextra', root },
  }
}

const inlineItems = async (
  directory: string,
  rawItems: unknown,
  documents: Map<string, TDocumentMetadata>,
): Promise<TSourceNode[]> => {
  const items = asRecord(rawItems)
  const result: TSourceNode[] = []
  for (const [key, rawValue] of Object.entries(items ?? {})) {
    const value = asRecord(rawValue)
    if (value?.type === 'separator') continue
    if (typeof value?.href === 'string') {
      result.push(linkNode(typeof value.title === 'string' ? value.title : key, value.href))
      continue
    }
    const document = fileForKey(directory, key, documents)
    if (document) {
      result.push(pageNode(document, typeof value?.title === 'string' ? value.title : undefined))
    }
  }
  return result
}
