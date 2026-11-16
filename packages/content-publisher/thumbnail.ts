import type { TArticleThumbnail, TThumbnailBlock } from './types'

type TRecord = Record<string, unknown>

const isRecord = (value: unknown): value is TRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const childrenOf = (node: TRecord): unknown[] => (Array.isArray(node.children) ? node.children : [])

const textOf = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return ''
  if (typeof value.text === 'string') return value.text
  return childrenOf(value).map(textOf).filter(Boolean).join(' ')
}

const compactText = (value: string, maxLength = 180): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized
}

const listItems = (node: TRecord): string[] =>
  childrenOf(node)
    .map(textOf)
    .map((item) => compactText(item, 100))
    .filter(Boolean)
    .slice(0, 8)

const tableShape = (node: TRecord): TThumbnailBlock => {
  const rows = childrenOf(node)
  const columns = Math.max(0, ...rows.map((row) => (isRecord(row) ? childrenOf(row).length : 0)))
  return { type: 'table', rows: Math.min(rows.length, 20), columns: Math.min(columns, 12) }
}

const blockFor = (node: TRecord): TThumbnailBlock | null => {
  const type = typeof node.type === 'string' ? node.type.toLowerCase() : ''
  const text = compactText(textOf(node))

  if (/^h[1-3]$/.test(type) || type === 'heading') {
    const rawLevel = type.startsWith('h') ? Number(type.slice(1)) : Number(node.level ?? 2)
    if (!text) return null
    return { type: 'heading', level: Math.max(1, Math.min(3, rawLevel)) as 1 | 2 | 3, text }
  }

  if (type === 'p' || type === 'paragraph') return text ? { type: 'paragraph', text } : null
  if (type === 'blockquote' || type === 'callout') return text ? { type: 'callout', text } : null

  if (type === 'ul' || type === 'ol' || type === 'list') {
    const items = listItems(node)
    return items.length ? { type: 'list', items } : null
  }

  if (type === 'img' || type === 'image') {
    const url = [node.url, node.src].find((value) => typeof value === 'string' && value.length > 0)
    if (typeof url !== 'string') return null
    const width = Number(node.width)
    const height = Number(node.height)
    const aspectRatio = width > 0 && height > 0 ? width / height : undefined
    return { type: 'image', url, ...(aspectRatio ? { aspectRatio } : {}) }
  }

  if (type === 'table') return tableShape(node)

  if (type === 'code_block' || type === 'code') {
    const lines = textOf(node)
      .split('\n')
      .map((line) => compactText(line, 100))
      .slice(0, 8)
    return lines.some(Boolean) ? { type: 'code', lines } : null
  }

  return null
}

const collect = (node: unknown, blocks: TThumbnailBlock[]): void => {
  if (!isRecord(node) || blocks.length >= 12) return
  const block = blockFor(node)
  if (block) {
    blocks.push(block)
    return
  }
  for (const child of childrenOf(node)) {
    collect(child, blocks)
    if (blocks.length >= 12) return
  }
}

/** Derives the public Article preview blocks from the exact Plate value being published. */
export const createArticleThumbnail = (value: unknown): TArticleThumbnail => {
  const blocks: TThumbnailBlock[] = []
  if (Array.isArray(value)) {
    for (const node of value) {
      collect(node, blocks)
      if (blocks.length >= 12) break
    }
  }
  return { version: 1, blocks }
}
