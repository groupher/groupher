import { describe, expect, it } from 'vitest'

import { bodyChanges, tagChanges } from './diffModel'
import type { Content } from './types'
const content = (blocks: unknown[], tags: number[] = []) =>
  ({ body: { json: JSON.stringify(blocks) }, tags }) as unknown as Content
describe('approval content comparison', () => {
  it('detects formatting and links even when visible text is unchanged', () => {
    const a = content([{ id: 'p', children: [{ text: 'same', bold: false }] }])
    const b = content([{ id: 'p', children: [{ text: 'same', bold: true }] }])
    expect(bodyChanges(a, b)).toMatchObject([{ type: 'changed', before: 'same', after: 'same' }])
  })
  it('reports additions, removals, moves and independent tag membership', () => {
    const a = content(
      [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      [1, 2],
    )
    const b = content(
      [
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ],
      [2, 3],
    )
    expect(bodyChanges(a, b).map((x) => x.type)).toEqual(['removed', 'changed', 'added'])
    expect(tagChanges(a, b)).toEqual({ added: [3], removed: [1] })
    expect(bodyChanges(a, a)).toEqual([])
  })
})
