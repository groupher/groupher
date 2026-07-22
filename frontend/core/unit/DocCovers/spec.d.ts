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

export type TPinnedDocAppearance = {
  light: Partial<TBgConfig>
  dark: Partial<TBgConfig>
}

export type TDocCoverPinnedDoc = {
  nodeId: string
  index: number
  appearance: TPinnedDocAppearance
  href: string
  doc: {
    title: string
    author?: { avatar?: string | null; nickname?: string | null } | null
    document?: { thumbnail?: TArticleThumbnail | null } | null
  }
}

export type TDocCoverNodeType = 'page' | 'link' | 'PAGE' | 'LINK'

export type TDocCoverGroupUiConfig = {
  layout?: TDocCoverLayout | null
  marker?: TMarkerValue | null
  desc?: string | null
}

export type TDocCoverItemUiConfig = {
  digest?: string | null
}

export type TDocCoverItem = {
  id: string
  nodeId: string
  docId?: string | null
  type: TDocCoverNodeType
  title: string
  digest?: string | null
  href: string
  index: number
  marker?: TMarkerValue | null
  badge?: string | null
  uiConfig?: TDocCoverItemUiConfig | null
}

export type TDocCoverGroup = {
  id: string
  groupId: string
  index: number
  title: string
  uiConfig?: TDocCoverGroupUiConfig | null
  items: readonly TDocCoverItem[]
}

export type TDocCoversData = {
  groups: readonly TDocCoverGroup[]
  pinnedDocs: readonly TDocCoverPinnedDoc[]
}

export type TDocCoverLayoutProps = {
  groups: readonly TDocCoverGroup[]
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

export type TDocCoversProps = {
  layout: TDocCoverLayout
  data: TDocCoversData
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
  onAddPinnedDoc?: () => void
  onEditPinnedDoc?: (doc: TDocCoverPinnedDoc) => void
  onUnpinDoc?: (doc: TDocCoverPinnedDoc) => void
  onReorderPinnedDocs?: (docs: readonly TDocCoverPinnedDoc[]) => void
}
