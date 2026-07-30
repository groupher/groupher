/**
 * Shared Markdown/MDX file metadata and body extraction.
 *
 *   raw source -> frontmatter + body -> AST title provenance -> route metadata
 *
 * @see docs/bulk-import/markdown-title-normalization.md
 */
import path from 'node:path'

import YAML from 'yaml'

import type { TSourceWorkspace } from '../contracts'
import { resolveDocumentTitle, type TDocumentTitleSource } from '../documentTitle'

const MARKDOWN = /\.mdx?$/i
const YAML_FRONTMATTER = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const DOCUMENT_READ_CONCURRENCY = 8

export type TDocumentMetadata = {
  body: string
  frontmatter: Record<string, unknown>
  metadataTitle?: string
  route: string
  sizeBytes: number
  sourcePath: string
  title: string
  titleSource: TDocumentTitleSource
}

export type TDocumentSource = {
  body: string
  frontmatter: Record<string, unknown>
}

const titleize = (value: string): string =>
  value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

/** Separates YAML frontmatter from body without mutating the stored source. */
export const extractDocumentSource = (source: string): TDocumentSource => {
  const frontmatterMatch = source.match(YAML_FRONTMATTER)
  if (!frontmatterMatch) return { body: source, frontmatter: {} }

  const decoded = YAML.parse(frontmatterMatch[1]) as unknown
  return {
    body: source.slice(frontmatterMatch[0].length),
    frontmatter:
      decoded && typeof decoded === 'object' && !Array.isArray(decoded)
        ? (decoded as Record<string, unknown>)
        : {},
  }
}

/** Derives the default route while collapsing index/page filename conventions. */
export const routeFromSourcePath = (sourcePath: string, root: string): string => {
  const relative = path.posix.relative(root, sourcePath).replace(MARKDOWN, '')
  const withoutPage = relative.replace(/\/page$/i, '')
  const withoutIndex = withoutPage.replace(/(^|\/)index$/i, '$1')
  const route = `/${withoutIndex}`.replace(/\/+/g, '/')
  return route.length > 1 && route.endsWith('/') ? route.slice(0, -1) : route
}

/** Parses one source file into canonical document metadata and title provenance. */
export const parseDocument = (
  sourcePath: string,
  source: string,
  root: string,
  sizeBytes: number,
): TDocumentMetadata => {
  const { body, frontmatter } = extractDocumentSource(source)
  const filename = path.posix.basename(sourcePath).replace(MARKDOWN, '')
  const resolvedTitle = resolveDocumentTitle(
    sourcePath,
    body,
    frontmatter.title,
    titleize(filename),
  )
  const slug = typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined

  return {
    body,
    frontmatter,
    ...resolvedTitle,
    route: slug?.startsWith('/') ? slug : routeFromSourcePath(sourcePath, root),
    sizeBytes,
    sourcePath,
  }
}

const mapWithConcurrency = async <TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> => {
  const results = new Array<TOutput>(inputs.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(concurrency, 1), inputs.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex
        nextIndex += 1
        if (index >= inputs.length) return
        results[index] = await mapper(inputs[index])
      }
    }),
  )

  return results
}

/** Loads and parses all Markdown/MDX documents below the framework content root. */
export const loadDocuments = async (
  workspace: TSourceWorkspace,
  root: string,
): Promise<Map<string, TDocumentMetadata>> => {
  const documents = new Map<string, TDocumentMetadata>()
  const files = workspace.files.filter(
    (file) => (!root || file.path.startsWith(`${root}/`)) && MARKDOWN.test(file.path),
  )
  const entries = await mapWithConcurrency(
    files,
    DOCUMENT_READ_CONCURRENCY,
    async (file) =>
      [
        file.path,
        parseDocument(file.path, await workspace.readText(file.path), root, file.sizeBytes),
      ] as const,
  )

  for (const [path, document] of entries) {
    documents.set(path, document)
  }

  return documents
}

/** Resolves a normalized route to the existing Markdown/MDX source candidate. */
export const sourcePathForRoute = (
  route: string,
  root: string,
  documents: Map<string, TDocumentMetadata>,
): string | null => {
  const clean = route.split(/[?#]/)[0].replace(/^\//, '').replace(/\/$/, '')
  const candidates = [
    path.posix.join(root, `${clean}.md`),
    path.posix.join(root, `${clean}.mdx`),
    path.posix.join(root, clean, 'index.md'),
    path.posix.join(root, clean, 'index.mdx'),
  ]
  return candidates.find((candidate) => documents.has(candidate)) ?? null
}
