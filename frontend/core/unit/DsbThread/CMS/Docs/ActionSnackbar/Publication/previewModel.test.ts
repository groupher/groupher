import { describe, expect, it } from 'vitest'

import { previewHref, projectPreviewCover, safeLink } from './previewModel'
import type { Node, Preview } from './types'
const node = (
  id: string,
  type: Node['type'],
  parent: string | null,
  extra: Partial<Node> = {},
): Node => ({
  node_id: id,
  type,
  parent_node_id: parent,
  index: 0,
  title: id,
  doc_id: null,
  href: null,
  hidden: false,
  ...extra,
})
describe('version-bound cover projection', () => {
  it('uses queued titles and protected article navigation without guessing a public number', () => {
    const data = {
      nodes: [
        node('group', 'group', null),
        node('page', 'page', 'group', { doc_id: 'new-article' }),
        node('external', 'link', 'group', { href: 'https://example.com' }),
        node('hidden', 'page', 'group', { doc_id: 'hidden', hidden: true }),
      ],
      presentation: {
        cards: [{ node_id: 'group', appearance: {} }],
        pinned_docs: [{ node_id: 'page', appearance: { light: {}, dark: {} } }],
        documents: {
          'new-article': { title: 'Queued title', thumbnail: { version: 1, blocks: [] } },
        },
        settings: {},
      },
    } as Preview
    const result = projectPreviewCover(data)
    expect(result.cards[0].items).toHaveLength(2)
    expect(result.cards[0].items[0]).toMatchObject({
      title: 'Queued title',
      href: previewHref('new-article'),
    })
    expect(result.cards[0].items[1].href).toBe('https://example.com')
    expect(result.pinnedDocs[0].doc.title).toBe('Queued title')
  })
  it('does not render selections for removed nodes or unsafe links', () => {
    const data = {
      nodes: [],
      presentation: {
        cards: [{ node_id: 'gone', appearance: {} }],
        pinned_docs: [{ node_id: 'gone', appearance: {} }],
        settings: {},
      },
    } as unknown as Preview
    expect(projectPreviewCover(data)).toEqual({ cards: [], pinnedDocs: [] })
    expect(safeLink('javascript:alert(1)')).toBe('')
    expect(safeLink('//untrusted.example')).toBe('')
  })
})
