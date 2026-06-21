import type { TRichEditorValue } from '@groupher/rich-editor'

import { REVISION_DRAWER } from '../constant'
import type { TArticleRevision, TArticleRevisionAuthor } from './spec'

type TPlateNode = {
  children?: TPlateNode[]
  id?: unknown
  text?: unknown
  type?: unknown
  [key: string]: unknown
}

export type TRevisionDiffBlockType = 'context' | 'added' | 'removed' | 'modified'

export type TRevisionInlineDiffType = 'same' | 'added' | 'removed'

export type TRevisionInlineDiff = {
  id: string
  text: string
  type: TRevisionInlineDiffType
}

export type TRichBlockSnapshot = {
  attrs: Record<string, unknown>
  blockType: string
  id: string
  raw: TPlateNode
  text: string
}

export type TRevisionDiffBlock = {
  after?: TRichBlockSnapshot
  afterInline?: TRevisionInlineDiff[]
  before?: TRichBlockSnapshot
  beforeInline?: TRevisionInlineDiff[]
  blockType: string
  id: string
  type: TRevisionDiffBlockType
}

export type TRevisionDiffStats = {
  additions: number
  deletions: number
}

export type TDedupedRevisions = {
  hiddenCount: number
  revisions: TArticleRevision[]
}

const BLOCK_ATTR_IGNORE_KEYS = new Set(['children', 'id', 'text', 'type'])
const TEXT_LIKE_BLOCK_TYPES = new Set([
  'blockquote',
  'code_block',
  'code_line',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'heading',
  'li',
  'lic',
  'p',
  'paragraph',
  'quote',
])

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)

  const record = value as Record<string, unknown>

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

const hashText = (text: string): string => {
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

const collectPlateText = (nodes: TPlateNode[]): string => {
  let text = ''

  for (const node of nodes) {
    if (typeof node.text === 'string') {
      text += node.text
    }

    if (Array.isArray(node.children)) {
      text += ` ${collectPlateText(node.children)}`
    }
  }

  return text
}

const getNodeText = (node: TPlateNode): string => {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''

  return collectPlateText(node.children).replace(/\s+/g, ' ').trim()
}

const getNodeAttrs = (node: TPlateNode): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(node)) {
    if (BLOCK_ATTR_IGNORE_KEYS.has(key)) continue
    attrs[key] = value
  }

  return attrs
}

const getBlockIdentity = (
  node: TPlateNode,
  blockType: string,
  attrs: Record<string, unknown>,
  text: string,
  index: number,
): string => {
  if (typeof node.id === 'string' && node.id) return node.id

  return `fallback-${blockType}-${hashText(`${stableStringify(attrs)}:${text}`)}-${index}`
}

const getBlockSignature = (block: TRichBlockSnapshot): string =>
  stableStringify({
    attrs: block.attrs,
    blockType: block.blockType,
    text: block.text,
  })

const isTextLikeBlock = (block: TRichBlockSnapshot): boolean =>
  TEXT_LIKE_BLOCK_TYPES.has(block.blockType) || !!block.text

const createInlineSegment = (
  type: TRevisionInlineDiffType,
  text: string,
  index: number,
): TRevisionInlineDiff => ({
  id: `${type}-${index}-${hashText(text)}`,
  text,
  type,
})

const tokenizeText = (text: string): string[] => Array.from(text)

const pushInlineSegment = (
  segments: TRevisionInlineDiff[],
  type: TRevisionInlineDiffType,
  text: string,
  index: number,
): void => {
  const previous = segments.at(-1)

  if (previous?.type === type) {
    previous.text += text
    return
  }

  segments.push(createInlineSegment(type, text, index))
}

const makeFullInline = (
  text: string,
  type: TRevisionInlineDiffType,
): TRevisionInlineDiff[] => (text ? [createInlineSegment(type, text, 0)] : [])

const makeSameInline = (text: string): TRevisionInlineDiff[] => makeFullInline(text, 'same')

const hasInlineType = (
  segments: TRevisionInlineDiff[] | undefined,
  type: TRevisionInlineDiffType,
): boolean => !!segments?.some((segment) => segment.type === type)

const sameBlock = (previous: TRichBlockSnapshot, current: TRichBlockSnapshot): boolean =>
  getBlockSignature(previous) === getBlockSignature(current)

const sameBlockIdentity = (previous: TRichBlockSnapshot, current: TRichBlockSnapshot): boolean =>
  previous.id === current.id || getBlockSignature(previous) === getBlockSignature(current)

const makeBlock = (
  type: TRevisionDiffBlockType,
  block: TRichBlockSnapshot,
): TRevisionDiffBlock => ({
  after: type === 'added' ? block : undefined,
  afterInline: type === 'added' ? makeFullInline(block.text, 'added') : undefined,
  before: type === 'removed' ? block : undefined,
  beforeInline: type === 'removed' ? makeFullInline(block.text, 'removed') : undefined,
  blockType: block.blockType,
  id: `${type}-${block.id}`,
  type,
})

const lcsMatrix = <T>(previous: T[], current: T[], isSame: (left: T, right: T) => boolean) => {
  const dp = Array.from({ length: previous.length + 1 }, () =>
    Array.from({ length: current.length + 1 }, () => 0),
  )

  for (let i = previous.length - 1; i >= 0; i -= 1) {
    for (let j = current.length - 1; j >= 0; j -= 1) {
      dp[i][j] = isSame(previous[i], current[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  return dp
}

const buildInlineDiff = (
  previousText: string,
  currentText: string,
): {
  after: TRevisionInlineDiff[]
  before: TRevisionInlineDiff[]
} => {
  const previousTokens = tokenizeText(previousText)
  const currentTokens = tokenizeText(currentText)
  const dp = lcsMatrix(previousTokens, currentTokens, (left, right) => left === right)
  const before: TRevisionInlineDiff[] = []
  const after: TRevisionInlineDiff[] = []
  let i = 0
  let j = 0
  let segmentIndex = 0

  while (i < previousTokens.length || j < currentTokens.length) {
    if (i < previousTokens.length && j < currentTokens.length && previousTokens[i] === currentTokens[j]) {
      pushInlineSegment(before, 'same', previousTokens[i], segmentIndex)
      pushInlineSegment(after, 'same', currentTokens[j], segmentIndex)
      i += 1
      j += 1
    } else if (i < previousTokens.length && (j >= currentTokens.length || dp[i + 1][j] >= dp[i][j + 1])) {
      pushInlineSegment(before, 'removed', previousTokens[i], segmentIndex)
      i += 1
    } else if (j < currentTokens.length) {
      pushInlineSegment(after, 'added', currentTokens[j], segmentIndex)
      j += 1
    }

    segmentIndex += 1
  }

  return { after, before }
}

const buildModifiedBlock = (
  previous: TRichBlockSnapshot,
  current: TRichBlockSnapshot,
): TRevisionDiffBlock => {
  const inline =
    isTextLikeBlock(previous) || isTextLikeBlock(current)
      ? buildInlineDiff(previous.text, current.text)
      : {
          after: makeFullInline(current.text || current.blockType, 'added'),
          before: makeFullInline(previous.text || previous.blockType, 'removed'),
        }

  return {
    after: current,
    afterInline: inline.after,
    before: previous,
    beforeInline: inline.before,
    blockType: current.blockType || previous.blockType,
    id: `modified-${previous.id}-${current.id}`,
    type: 'modified',
  }
}

const pairChangedBlocks = (blocks: TRevisionDiffBlock[]): TRevisionDiffBlock[] => {
  const paired: TRevisionDiffBlock[] = []

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const next = blocks[index + 1]

    if (block.type === 'removed' && next?.type === 'added') {
      const previous = block.before
      const current = next.after

      if (previous && current && previous.blockType === current.blockType) {
        paired.push(buildModifiedBlock(previous, current))
        index += 1
        continue
      }
    }

    paired.push(block)
  }

  return paired
}

/**
 * Convert Plate's top-level value into block snapshots used by revision diff.
 *
 * The primary identity is Plate's built-in `nodeId` value (`node.id`). If an
 * old snapshot does not have ids, the fallback identity includes block type,
 * normalized text/attrs, and index so old revisions still render instead of
 * failing.
 *
 * ## Example
 *
 * ```ts
 * normalizeRichEditorBlocks([
 *   { id: 'a', type: 'p', children: [{ text: 'hello' }] },
 * ])
 * // => [{ id: 'a', blockType: 'p', text: 'hello', attrs: {}, raw: ... }]
 * ```
 */
export const normalizeRichEditorBlocks = (value: TRichEditorValue): TRichBlockSnapshot[] =>
  (value as TPlateNode[]).map((node, index) => {
    const blockType = typeof node.type === 'string' ? node.type : 'unknown'
    const attrs = getNodeAttrs(node)
    const text = getNodeText(node)

    return {
      attrs,
      blockType,
      id: getBlockIdentity(node, blockType, attrs, text, index),
      raw: node,
      text,
    }
  })

/**
 * Build a block-first revision diff for rich editor values.
 *
 * The result is intentionally generic: paragraph, quote, code, image, and
 * future blocks all become `TRevisionDiffBlock`. Text-like blocks additionally
 * include inline diff segments, while non-text blocks can still render as
 * added/removed/modified at block level.
 *
 * ## Example
 *
 * ```ts
 * const diff = buildRevisionDiffBlocks(previousValue, currentValue)
 * const stats = computeRevisionDiffStatsFromBlocks(diff)
 * // deleting text inside one paragraph can produce { additions: 0, deletions: 1 }
 * ```
 */
export const buildRevisionDiffBlocks = (
  previousValue: TRichEditorValue,
  currentValue: TRichEditorValue,
): TRevisionDiffBlock[] => {
  const previousBlocks = normalizeRichEditorBlocks(previousValue)
  const currentBlocks = normalizeRichEditorBlocks(currentValue)
  const dp = lcsMatrix(previousBlocks, currentBlocks, sameBlockIdentity)
  const blocks: TRevisionDiffBlock[] = []
  let i = 0
  let j = 0

  while (i < previousBlocks.length && j < currentBlocks.length) {
    const previous = previousBlocks[i]
    const current = currentBlocks[j]

    if (sameBlockIdentity(previous, current)) {
      blocks.push(
        sameBlock(previous, current)
          ? {
              after: current,
              afterInline: makeSameInline(current.text),
              before: previous,
              beforeInline: makeSameInline(previous.text),
              blockType: current.blockType,
              id: `context-${current.id}`,
              type: 'context',
            }
          : buildModifiedBlock(previous, current),
      )
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      blocks.push(makeBlock('removed', previous))
      i += 1
    } else {
      blocks.push(makeBlock('added', current))
      j += 1
    }
  }

  while (i < previousBlocks.length) {
    blocks.push(makeBlock('removed', previousBlocks[i]))
    i += 1
  }

  while (j < currentBlocks.length) {
    blocks.push(makeBlock('added', currentBlocks[j]))
    j += 1
  }

  return pairChangedBlocks(blocks)
}

export const computeRevisionDiffStatsFromBlocks = (
  blocks: TRevisionDiffBlock[],
): TRevisionDiffStats => {
  return blocks.reduce<TRevisionDiffStats>(
    (stats, block) => {
      if (block.type === 'added') return { ...stats, additions: stats.additions + 1 }
      if (block.type === 'removed') return { ...stats, deletions: stats.deletions + 1 }
      if (block.type !== 'modified') return stats

      return {
        additions: stats.additions + (hasInlineType(block.afterInline, 'added') ? 1 : 0),
        deletions: stats.deletions + (hasInlineType(block.beforeInline, 'removed') ? 1 : 0),
      }
    },
    { additions: 0, deletions: 0 },
  )
}

export const computeRevisionDiffStats = (
  previousValue: TRichEditorValue,
  currentValue: TRichEditorValue,
): TRevisionDiffStats =>
  computeRevisionDiffStatsFromBlocks(buildRevisionDiffBlocks(previousValue, currentValue))

export const EMPTY_REVISION_VALUE: TRichEditorValue = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

export const parseRevisionDocumentValue = (json?: string | null): TRichEditorValue => {
  if (!json) return EMPTY_REVISION_VALUE

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as TRichEditorValue) : EMPTY_REVISION_VALUE
  } catch {
    return EMPTY_REVISION_VALUE
  }
}

export const dedupeRevisionsBySnapshot = (revisions: TArticleRevision[]): TDedupedRevisions => {
  const seen = new Set<string>()
  const deduped: TArticleRevision[] = []

  for (const revision of revisions) {
    const key = revision.contentHash || revision.documentJson || revision.id

    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(revision)
  }

  return {
    hiddenCount: revisions.length - deduped.length,
    revisions: deduped,
  }
}

export const getRevisionAuthorName = (author?: TArticleRevisionAuthor | null): string =>
  author?.nickname || author?.login || REVISION_DRAWER.UNKNOWN_AUTHOR

export const getRevisionAuthorInitial = (author?: TArticleRevisionAuthor | null): string =>
  getRevisionAuthorName(author).trim().charAt(0).toUpperCase() || '?'

export const formatRelativeRevisionTime = (datetime?: string | null): string => {
  if (!datetime) return REVISION_DRAWER.UNKNOWN_TIME

  const timestamp = new Date(datetime).getTime()
  if (Number.isNaN(timestamp)) return REVISION_DRAWER.UNKNOWN_TIME

  const seconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0)
  if (seconds < 60) return REVISION_DRAWER.JUST_NOW

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

export const buildRevisionExcerpt = (revision: TArticleRevision): string => {
  if (revision.digest) return revision.digest

  if (!revision.documentJson) return REVISION_DRAWER.EMPTY_EXCERPT

  try {
    const value = JSON.parse(revision.documentJson)
    if (!Array.isArray(value)) return REVISION_DRAWER.EMPTY_EXCERPT

    return collectPlateText(value).trim() || REVISION_DRAWER.EMPTY_EXCERPT
  } catch {
    return REVISION_DRAWER.EMPTY_EXCERPT
  }
}
