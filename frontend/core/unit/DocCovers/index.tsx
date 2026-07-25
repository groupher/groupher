import { DOC_COVER_LAYOUT } from '~/const/layout'

import BriefCardsLayout from './BriefCardsLayout'
import CoverCardsLayout from './CoverCardsLayout'
import OutlineColumnsLayout from './OutlineColumnsLayout'
import OutlineTocLayout from './OutlineTocLayout'
import PinnedDocsRow from './PinnedDocsRow'
import type { TDocCoversProps } from './spec'
import StackCardsLayout from './StackCardsLayout'
import TileCardsLayout from './TileCardsLayout'

export default function DocCovers({
  layout,
  data,
  editable = false,
  onEditCard,
  onAddPinnedDoc,
  onEditPinnedDoc,
  onUnpinDoc,
  onReorderPinnedDocs,
}: TDocCoversProps) {
  const props = {
    cards: data.cards,
    editable,
    onEditCard,
  }

  let content = <StackCardsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS) content = <OutlineColumnsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.OUTLINE_TOC) content = <OutlineTocLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.BRIEF_CARDS) content = <BriefCardsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.COVER_CARDS) content = <CoverCardsLayout {...props} />
  if (layout === DOC_COVER_LAYOUT.TILE_CARDS) content = <TileCardsLayout {...props} />

  return (
    <>
      <PinnedDocsRow
        docs={data.pinnedDocs}
        editable={editable}
        onAdd={onAddPinnedDoc}
        onEdit={onEditPinnedDoc}
        onUnpin={onUnpinDoc}
        onReorder={onReorderPinnedDocs}
      />
      {content}
    </>
  )
}
