import type {
  TDocCovers,
  TDocCoverCardItem,
  TDocCoverCardAppearance,
  TDocCoverPinnedDocAppearance,
  TArticleThumbnail,
} from '~/unit/DocCovers/spec'

import type { Node, Preview } from './types'

/** Creates a protected preview link without assuming a public article number. */
export const previewHref = (id: string) => `#docs-preview/${id}`
/** Projects the authorized target tree through the same public Cover components. */
export function projectPreviewCover(data: Preview): TDocCovers {
  const visible = (node: Node): boolean => {
    const seen = new Set<string>()
    let current: Node | undefined = node
    while (current) {
      if (current.hidden || seen.has(current.node_id)) return false
      seen.add(current.node_id)
      if (!current.parent_node_id) return true
      current = data.nodes.find((parent) => parent.node_id === current!.parent_node_id)
    }
    return false
  }
  const children = (id: string) =>
    data.nodes
      .filter((node) => node.parent_node_id === id && !node.hidden)
      .sort((a, b) => a.index - b.index)
  const leaves = (node: Node): Node[] =>
    node.type === 'group' ? children(node.node_id).flatMap(leaves) : [node]
  const href = (node: Node): string =>
    node.doc_id
      ? previewHref(node.doc_id)
      : node.type === 'group'
        ? leaves(node)[0]
          ? href(leaves(node)[0])
          : ''
        : safeLink(node.href)
  return {
    cards: data.presentation.cards.flatMap((card, index) => {
      const node = data.nodes.find((n) => n.node_id === card.node_id && visible(n))
      if (!node) return []
      const items: TDocCoverCardItem[] = children(node.node_id).flatMap<TDocCoverCardItem>(
        (child) => {
          const link = href(child)
          if (!link || child.type === 'tab' || child.type === 'pin') return []
          const base = {
            id: child.node_id,
            nodeId: child.node_id,
            title: data.presentation.documents?.[child.doc_id ?? '']?.title ?? child.title,
            href: link,
            index: child.index,
          }
          if (child.type === 'page') return [{ ...base, type: 'page', docId: child.doc_id! }]
          if (child.type === 'link') return [{ ...base, type: 'link' }]
          return [{ ...base, type: 'group', leafCount: leaves(child).length }]
        },
      )
      return [
        {
          id: node.node_id,
          groupNodeId: node.node_id,
          index,
          title: node.title,
          appearance: card.appearance as TDocCoverCardAppearance,
          items,
        },
      ]
    }),
    pinnedDocs: data.presentation.pinned_docs.flatMap((pin, index) => {
      const node = data.nodes.find((n) => n.node_id === pin.node_id && visible(n))
      if (!node?.doc_id) return []
      const doc = data.presentation.documents?.[node.doc_id]
      return [
        {
          nodeId: node.node_id,
          index,
          appearance: pin.appearance as TDocCoverPinnedDocAppearance,
          href: previewHref(node.doc_id),
          doc: {
            title: doc?.title ?? node.title,
            thumbnail: doc?.thumbnail as TArticleThumbnail | undefined,
          },
        },
      ]
    }),
  }
}
/** Keeps unsafe schemes out of saved directory links. */
export const safeLink = (href: string | null): string =>
  href && /^(https?:\/\/|\/(?!\/)|#)/i.test(href) ? href : ''
