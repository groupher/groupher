/**
 * Adapts Fumadocs sources into the canonical Docs import tree.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import path from 'node:path'

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, type TDocumentMetadata } from '../documentFile'
import { asRecord, linkNode, pageNode, scopeNode, sectionNode, slugify } from '../helpers'

const META_READ_CONCURRENCY = 8

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
  filePaths: ReadonlySet<string>,
): Promise<TSourceNode | null> => {
  const metaPath = `${directory}/meta.json`
  if (!filePaths.has(metaPath)) return null
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

const loadDirectorySections = async (
  root: string,
  pages: readonly unknown[],
  workspace: TSourceWorkspace,
  documents: Map<string, TDocumentMetadata>,
  filePaths: ReadonlySet<string>,
): Promise<Map<string, TSourceNode>> => {
  const entries = [
    ...new Set(
      pages.filter(
        (entry): entry is string =>
          typeof entry === 'string' && filePaths.has(`${root}/${entry}/meta.json`),
      ),
    ),
  ]
  const sections = new Map<string, TSourceNode>()
  let nextIndex = 0
  const workerCount = Math.min(META_READ_CONCURRENCY, entries.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex
        nextIndex += 1
        if (index >= entries.length) return

        const entry = entries[index]
        const section = await directorySection(`${root}/${entry}`, workspace, documents, filePaths)
        if (section) sections.set(entry, section)
      }
    }),
  )

  return sections
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
  const pages = Array.isArray(meta?.pages) ? meta.pages : []
  const filePaths = new Set(workspace.files.map((file) => file.path))
  const directorySections = await loadDirectorySections(
    root,
    pages,
    workspace,
    documents,
    filePaths,
  )
  const directChildren: TSourceNode[] = []
  const usedPaths = new Set<string>()
  let activeSection: { children: TSourceNode[]; title: string } | null = null

  const append = (item: TSourceNode): void => {
    if (activeSection) activeSection.children.push(item)
    else directChildren.push(item)
  }

  for (const rawEntry of pages) {
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
    const child = directorySections.get(rawEntry)
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
    ...new Set([
      sourceConfig,
      ...workspace.files
        .map((file) => file.path)
        .filter((file) => file.startsWith(`${root}/`) && file.endsWith('/meta.json'))
        .sort(),
      metaPath,
    ]),
  ]

  return {
    navigation: [
      scopeNode('meta:docs', String(meta?.title || 'Documentation'), '/', directChildren),
    ],
    schemaVersion: 2,
    source: { configPaths, framework: 'fumadocs', root },
  }
}
