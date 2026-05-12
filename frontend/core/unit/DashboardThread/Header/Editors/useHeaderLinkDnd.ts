import { useMemo } from 'react'

import type { THeaderLinkChild, THeaderLinkItem } from '~/spec'

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
  links: readonly THeaderLinkItem[]
  community: string
  onCommit: (links: readonly THeaderLinkItem[]) => void
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

  return useSortableDraft<THeaderColumn, THeaderLinkChild, THeaderDragTarget, THeaderLinkItem>({
    sourceColumns,
    findColumnWithLink,
    flattenColumns: flattenHeaderColumns,
    moveLinkInColumns: moveHeaderLinkInColumns,
    sameLinks: sameHeaderLinks,
    onCommit,
  })
}
