import type { TBgConfig } from '~/lib/bg'
import type { TDocCoverLayout, TMarkerValue } from '~/spec'

export type TArticleThumbnail = {
  version: number
  blocks: readonly TThumbnailBlock[]
}

export type TThumbnailBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph' | 'callout'; text: string }
  | { type: 'list'; items: readonly string[] }
  | { type: 'image'; url: string; aspectRatio?: number }
  | { type: 'table'; rows: number; columns: number }
  | { type: 'code'; lines: readonly string[] }

export type TDocCoverPinnedDocAppearance = {
  light: Partial<TBgConfig>
  dark: Partial<TBgConfig>
}

export type TDocCoverPinnedDoc = {
  nodeId: string
  index: number
  appearance: TDocCoverPinnedDocAppearance
  href: string
  doc: {
    title: string
    author?: { avatar?: string | null; nickname?: string | null } | null
    document?: { thumbnail?: TArticleThumbnail | null } | null
  }
}

export type TDocCoverCardAppearance = {
  layout?: TDocCoverLayout | null
  marker?: TMarkerValue | null
}

type TDocCoverCardItemBase<TType extends 'group' | 'page' | 'link'> = {
  id: string
  nodeId: string
  type: TType
  title: string
  href: string
  index: number
  marker?: TMarkerValue | null
  badge?: string | null
}

export type TDocCoverPageItem = TDocCoverCardItemBase<'page'> & {
  docId: string
}

export type TDocCoverLinkItem = TDocCoverCardItemBase<'link'>

export type TDocCoverGroupItem = TDocCoverCardItemBase<'group'> & {
  /** Number of accessible Public Page and Link leaves in this Group subtree. */
  leafCount: number
}

export type TDocCoverCardItem = TDocCoverPageItem | TDocCoverLinkItem | TDocCoverGroupItem

export type TDocCoverCard = {
  id: string
  groupNodeId: string
  index: number
  title: string
  appearance: TDocCoverCardAppearance
  items: readonly TDocCoverCardItem[]
}

export type TDocCovers = {
  cards: readonly TDocCoverCard[]
  pinnedDocs: readonly TDocCoverPinnedDoc[]
}

export type TDocCoverLayoutProps = {
  cards: readonly TDocCoverCard[]
  editable?: boolean
  onEditCard?: (card: TDocCoverCard) => void
}

export type TDocCoversProps = {
  layout: TDocCoverLayout
  data: TDocCovers
  editable?: boolean
  onEditCard?: (card: TDocCoverCard) => void
  onAddPinnedDoc?: () => void
  onEditPinnedDoc?: (doc: TDocCoverPinnedDoc) => void
  onUnpinDoc?: (doc: TDocCoverPinnedDoc) => void
  onReorderPinnedDocs?: (docs: readonly TDocCoverPinnedDoc[]) => void
}
