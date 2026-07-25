import path from 'node:path'

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, type TDocumentMetadata } from '../documentFile'
import { asRecord, linkNode, pageNode, scopeNode, sectionNode, slugify } from '../helpers'

const documentFor = (
  directory: string,
  name: string,
  documents: Map<string, TDocumentMetadata>,
): TDocumentMetadata | undefined =>
  documents.get(`${directory}/${name}.md`) ??
  documents.get(`${directory}/${name}.mdx`) ??
  documents.get(`${directory}/${name}/index.mdx`)

const directorySection = async (
  directory: string,
  workspace: TSourceWorkspace,
  documents: Map<string, TDocumentMetadata>,
): Promise<TSourceNode | null> => {
  const metaPath = `${directory}/meta.json`
  if (!workspace.files.some((file) => file.path === metaPath)) return null
  const meta = asRecord(JSON.parse(await workspace.readText(metaPath)))
  const children: TSourceNode[] = []
  for (const name of Array.isArray(meta?.pages) ? meta.pages : []) {
    if (typeof name !== 'string') continue
    const document = documentFor(directory, name, documents)
    if (document) children.push(pageNode(document))
  }
  return sectionNode(
    `directory:${path.posix.basename(directory)}`,
    String(meta?.title || path.posix.basename(directory)),
    children,
  )
}

/** Maps Fumadocs meta files, separators, directories, and links into SourceTree.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export const analyzeFumadocs = async (workspace: TSourceWorkspace): Promise<TSourceTree> => {
  const sourceConfig = workspace.files
    .map((file) => file.path)
    .find((file) => /^source\.config\.ts$/.test(file))!
  const source = await workspace.readText(sourceConfig)
  const root = source.match(/dir\s*:\s*['"]([^'"]+)['"]/)?.[1] || 'content/docs'
  const documents = await loadDocuments(workspace, root)
  const metaPath = `${root}/meta.json`
  const meta = asRecord(JSON.parse(await workspace.readText(metaPath)))
  const directChildren: TSourceNode[] = []
  const usedPaths = new Set<string>()
  let activeSection: { children: TSourceNode[]; title: string } | null = null

  const append = (item: TSourceNode): void => {
    if (activeSection) activeSection.children.push(item)
    else directChildren.push(item)
  }

  for (const rawEntry of Array.isArray(meta?.pages) ? meta.pages : []) {
    if (typeof rawEntry !== 'string') continue
    const separator = rawEntry.match(/^---(.+)---$/)
    if (separator) {
      if (activeSection) {
        directChildren.push(
          sectionNode(
            `separator:${slugify(activeSection.title)}`,
            activeSection.title,
            activeSection.children,
          ),
        )
      }
      activeSection = { children: [], title: separator[1] }
      continue
    }
    if (rawEntry === '...') {
      for (const document of documents.values()) {
        if (!usedPaths.has(document.sourcePath)) append(pageNode(document))
      }
      continue
    }
    const link = rawEntry.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (link) {
      append(linkNode(link[1], link[2]))
      continue
    }
    const document = documentFor(root, rawEntry, documents)
    if (document) {
      usedPaths.add(document.sourcePath)
      append({ ...pageNode(document), route: rawEntry === 'index' ? '/index' : document.route })
    }
    const childDirectory = `${root}/${rawEntry}`
    const child = await directorySection(childDirectory, workspace, documents)
    if (child) {
      for (const nested of child.type === 'section' ? child.pages : []) {
        if (nested.type === 'page') usedPaths.add(nested.sourcePath)
      }
      append(child)
    }
  }
  if (activeSection) {
    directChildren.push(
      sectionNode(
        `separator:${slugify(activeSection.title)}`,
        activeSection.title,
        activeSection.children,
      ),
    )
  }
  const configPaths = [
    sourceConfig,
    ...workspace.files
      .map((file) => file.path)
      .filter((file) => file.startsWith(`${root}/`) && file.endsWith('/meta.json'))
      .sort(),
    metaPath,
  ].filter((value, index, values) => values.indexOf(value) === index)

  return {
    navigation: [
      scopeNode('meta:docs', String(meta?.title || 'Documentation'), '/', directChildren),
    ],
    schemaVersion: 2,
    source: { configPaths, framework: 'fumadocs', root },
  }
}
