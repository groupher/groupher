/** Shared SourceTree constructors used by framework adapters.
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import path from 'node:path'

import type {
  TSourceLink,
  TSourceNode,
  TSourcePage,
  TSourceScope,
  TSourceSection,
} from '../contracts'
import type { TDocumentMetadata } from './documentFile'

const navigationTitle = (document: TDocumentMetadata): string => {
  const sidebarLabel = document.frontmatter.sidebar_label
  return typeof sidebarLabel === 'string' && sidebarLabel.trim()
    ? sidebarLabel.trim()
    : (document.metadataTitle ?? document.title)
}

/** Converts a source label into a stable lowercase identifier fragment. */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Builds a canonical page while preserving explicit navigation-title precedence. */
export const pageNode = (
  document: TDocumentMetadata,
  title?: string,
  options: Pick<TSourcePage, 'navigationStatus'> = {},
): TSourcePage => ({
  ...(document.frontmatter.draft === true ? { draft: true } : {}),
  ...options,
  type: 'page',
  route: document.route,
  sizeBytes: document.sizeBytes,
  sourceId: document.sourcePath,
  sourcePath: document.sourcePath,
  title: title || navigationTitle(document),
})

/** Builds a canonical external navigation link. */
export const linkNode = (title: string, href: string): TSourceLink => ({
  href,
  type: 'link',
  sourceId: `external:${href}`,
  title,
})

/** Builds a canonical recursive navigation section. */
export const sectionNode = (
  sourceId: string,
  title: string,
  pages: TSourceNode[],
): TSourceSection => ({ pages, type: 'section', sourceId, title })

/** Builds a top-level source navigation scope and route prefix. */
export const scopeNode = (
  sourceId: string,
  title: string,
  routePrefix: string,
  pages: TSourceNode[],
): TSourceScope => ({ pages, type: 'scope', routePrefix, sourceId, title })

/** Produces fallback navigation when a framework has no explicit sidebar configuration. */
export const directoryTree = (
  root: string,
  documents: Map<string, TDocumentMetadata>,
): TSourceScope[] => {
  const topLevel = new Map<string, TDocumentMetadata[]>()
  for (const document of documents.values()) {
    const relative = path.posix.relative(root, document.sourcePath)
    const first = relative.split('/')[0]
    const key = relative.includes('/') ? first : 'docs'
    topLevel.set(key, [...(topLevel.get(key) ?? []), document])
  }

  return Array.from(topLevel.entries()).map(([directory, values]) => {
    const routePrefix = directory === 'docs' ? '/' : `/${directory}/`
    return scopeNode(
      `directory:${directory === 'docs' ? root : `${root}/${directory}`}`,
      directory === 'docs'
        ? 'Documentation'
        : directory.replace(/[-_]/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()),
      routePrefix,
      values.sort((a, b) => a.route.localeCompare(b.route)).map((document) => pageNode(document)),
    )
  })
}

/** Narrows an unknown static-config value to a plain record. */
export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
