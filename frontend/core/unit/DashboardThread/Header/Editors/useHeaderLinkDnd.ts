import { useMemo } from 'react'

import type { TLinkChild, TLinkItem } from '~/spec'

import useSortableDraft from '../../LinkEditor/Dnd/useSortableDraft'
import {
  buildHeaderColumns,
  findColumnWithLink,
  flattenHeaderColumns,
  moveHeaderLinkInColumns,
  sameHeaderLinks,
} from './model'
import type { THeaderColumn, THeaderDragTarget } from './spec'

type TProps = {
  links: readonly TLinkItem[]
  community: string
  onCommit: (links: readonly TLinkItem[]) => void
}

type TRet = {
  columns: THeaderColumn[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findColumnWithLink>
  startDrag: (itemId: string) => void
  moveDrag: (target?: THeaderDragTarget | null) => void
  commitDrag: (target?: THeaderDragTarget | null) => void
  cancelDrag: () => void
}

// Keeps a local column draft while dragging header links. The draft updates during
// cross-group hover, then commits once on drop to avoid expensive parent updates.
export default function useHeaderLinkDnd({ links, community, onCommit }: TProps): TRet {
  const sourceColumns = useMemo(() => buildHeaderColumns(links, community), [community, links])

  return useSortableDraft<THeaderColumn, TLinkChild, THeaderDragTarget, TLinkItem>({
    sourceColumns,
    findColumnWithLink,
    flattenColumns: flattenHeaderColumns,
    moveLinkInColumns: moveHeaderLinkInColumns,
    sameLinks: sameHeaderLinks,
    onCommit,
  })
}
