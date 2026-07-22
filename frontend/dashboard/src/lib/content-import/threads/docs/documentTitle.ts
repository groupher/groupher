/**
 * AST-based title provenance and promoted-H1 normalization.
 *
 *   frontmatter/static MDX metadata --+
 *   first meaningful root H1 ----------+--> title + titleSource
 *   filename fallback -----------------+
 *
 * @see docs/bulk-import/markdown-title-normalization.md
 */
import type { TRichEditorNodeValue } from '@groupher/rich-editor/node'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { mdxFromMarkdown } from 'mdast-util-mdx'
import { toString } from 'mdast-util-to-string'
import { mdxjs } from 'micromark-extension-mdxjs'

import type { TDocumentTitleSource } from './contracts/sourceAnalysis'

export type { TDocumentTitleSource } from './contracts/sourceAnalysis'

export type TResolvedDocumentTitle = {
  metadataTitle?: string
  title: string
  titleSource: TDocumentTitleSource
}

type TNode = {
  children?: TNode[]
  data?: unknown
  depth?: number
  type?: string
  value?: unknown
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const staticString = (value: unknown): string | undefined => {
  const node = record(value)
  if (!node) return undefined
  if (node.type === 'Literal') return nonEmptyString(node.value)
  if (node.type !== 'TemplateLiteral') return undefined

  const expressions = Array.isArray(node.expressions) ? node.expressions : []
  const quasis = Array.isArray(node.quasis) ? node.quasis : []
  if (expressions.length > 0 || quasis.length !== 1) return undefined

  const quasi = record(quasis[0])
  const cooked = record(quasi?.value)?.cooked
  return nonEmptyString(cooked)
}

const propertyName = (value: unknown): string | undefined => {
  const node = record(value)
  if (!node) return undefined
  if (node.type === 'Identifier') return nonEmptyString(node.name)
  if (node.type === 'Literal') return nonEmptyString(node.value)
  return undefined
}

const objectTitle = (value: unknown): string | undefined => {
  const node = record(value)
  if (node?.type !== 'ObjectExpression' || !Array.isArray(node.properties)) return undefined

  for (const value of node.properties) {
    const property = record(value)
    if (property?.type !== 'Property' || propertyName(property.key) !== 'title') continue
    const title = staticString(property.value)
    if (title) return title
  }
  return undefined
}

const declarationTitle = (value: unknown): string | undefined => {
  const declaration = record(value)
  if (declaration?.type !== 'VariableDeclaration' || !Array.isArray(declaration.declarations)) {
    return undefined
  }

  for (const value of declaration.declarations) {
    const declarator = record(value)
    if (declarator?.type !== 'VariableDeclarator') continue
    const name = propertyName(declarator.id)
    if (name === 'title') {
      const title = staticString(declarator.init)
      if (title) return title
    }
    if (name === 'metadata' || name === 'frontmatter') {
      const title = objectTitle(declarator.init)
      if (title) return title
    }
  }
  return undefined
}

const exportedMetadataTitle = (children: TNode[]): string | undefined => {
  for (const child of children) {
    if (child.type !== 'mdxjsEsm') continue
    const data = record(child.data)
    const program = record(data?.estree)
    const statements = Array.isArray(program?.body) ? program.body : []
    for (const value of statements) {
      const statement = record(value)
      if (statement?.type !== 'ExportNamedDeclaration') continue
      const title = declarationTitle(statement.declaration)
      if (title) return title
    }
  }
  return undefined
}

const isCommentPreamble = (node: TNode): boolean => {
  if (node.type === 'html') {
    return typeof node.value === 'string' && /^\s*<!--[\s\S]*-->\s*$/.test(node.value)
  }
  if (node.type === 'mdxFlowExpression') {
    return typeof node.value === 'string' && /^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value)
  }
  return false
}

const markdownTree = (sourcePath: string, body: string): TNode[] => {
  if (/\.mdx$/i.test(sourcePath)) {
    try {
      return fromMarkdown(body, {
        extensions: [mdxjs()],
        mdastExtensions: [mdxFromMarkdown()],
      }).children as TNode[]
    } catch {
      // Unsupported vendor MDX must not block source analysis. Body conversion reports the detail later.
    }
  }

  return fromMarkdown(body).children as TNode[]
}

const leadingHeadingTitle = (children: TNode[]): string | undefined => {
  const first = children.find((node) => node.type !== 'mdxjsEsm' && !isCommentPreamble(node))
  if (first?.type !== 'heading' || first.depth !== 1) return undefined
  return nonEmptyString(toString(first as Parameters<typeof toString>[0]))
}

/** Resolves visible title and provenance without executing source MDX code. */
export const resolveDocumentTitle = (
  sourcePath: string,
  body: string,
  frontmatterTitle: unknown,
  filenameTitle: string,
): TResolvedDocumentTitle => {
  const children = markdownTree(sourcePath, body)
  const metadataTitle = nonEmptyString(frontmatterTitle) ?? exportedMetadataTitle(children)
  const headingTitle = leadingHeadingTitle(children)

  if (headingTitle) return { metadataTitle, title: headingTitle, titleSource: 'heading' }
  if (metadataTitle) return { metadataTitle, title: metadataTitle, titleSource: 'metadata' }
  return { title: filenameTitle, titleSource: 'filename' }
}

/** Removes only the target-AST H1 proven to have been promoted into the Doc title. */
export const consumePromotedHeading = (
  value: TRichEditorNodeValue,
  titleSource: TDocumentTitleSource,
): TRichEditorNodeValue =>
  titleSource === 'heading' && value[0]?.type === 'h1' ? value.slice(1) : value
