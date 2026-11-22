import type { Content } from './types'

type Block = { id?: string; text?: string; children?: Block[]; [key: string]: unknown }
const blocks = (value: unknown): Block[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const text = (block: Block | undefined): string =>
  block ? (block.text ?? block.children?.map(text).join('') ?? '') : ''
/** Compares canonical Plate blocks, including order, marks and link attributes. */
export function bodyChanges(before: Content | null, after: Content | null) {
  const index = (content: Content | null) =>
    new Map(
      blocks(content?.body.json).map((block, position) => [
        block.id ?? `position:${position}`,
        { block, position },
      ]),
    )
  const left = index(before),
    right = index(after)
  return [...new Set([...left.keys(), ...right.keys()])].flatMap((id) => {
    const a = left.get(id),
      b = right.get(id)
    if (JSON.stringify(a) === JSON.stringify(b)) return []
    return [
      {
        id,
        type: !a ? 'added' : !b ? 'removed' : 'changed',
        before: text(a?.block),
        after: text(b?.block),
      },
    ]
  })
}
/** Returns tag membership changes independently of ordering. */
export function tagChanges(before: Content | null, after: Content | null) {
  const left = new Set(Array.isArray(before?.tags) ? before.tags : []),
    right = new Set(Array.isArray(after?.tags) ? after.tags : [])
  return {
    added: [...right].filter((id) => !left.has(id)),
    removed: [...left].filter((id) => !right.has(id)),
  }
}
