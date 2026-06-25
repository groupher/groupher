import { DOC_COVER_LAYOUT } from '~/const/layout'

import BriefCardsLayout from './BriefCardsLayout'
import CoverCardsLayout from './CoverCardsLayout'
import OutlineColumnsLayout from './OutlineColumnsLayout'
import OutlineTocLayout from './OutlineTocLayout'
import type { TDocCoversProps } from './spec'
import StackCardsLayout from './StackCardsLayout'
import TileCardsLayout from './TileCardsLayout'

export default function DocCovers({
  layout,
  data,
  editable = false,
  onEditGroup,
}: TDocCoversProps) {
  const props = {
    groups: data.groups,
    pinnedItems: data.pinnedItems,
    editable,
    onEditGroup,
  }

  if (layout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS) return <OutlineColumnsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.OUTLINE_TOC) return <OutlineTocLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.BRIEF_CARDS) return <BriefCardsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.COVER_CARDS) return <CoverCardsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.TILE_CARDS) return <TileCardsLayout {...props} />

  return <StackCardsLayout {...props} />
}
