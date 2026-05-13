import { useMemo } from 'react'

import type { TLinkChild, TLinkItem } from '~/spec'

import useSortableDraft from '../../LinkEditor/Dnd/useSortableDraft'
import {
  buildHeaderColumns,
  findColumnWithLink,
  flattenHeaderColumns,
  moveHeaderColumn,
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

// Wires header-specific column adapters into the shared DnD draft controller.
// The header adapter understands single-link columns and the fixed More column,
// so callers can treat the returned columns as the complete editor view model.
export default function useHeaderLinkDnd({ links, community, onCommit }: TProps): TRet {
  const sourceColumns = useMemo(() => buildHeaderColumns(links, community), [community, links])

  return useSortableDraft<THeaderColumn, TLinkChild, THeaderDragTarget, TLinkItem>({
    sourceColumns,
    findColumnWithLink,
    flattenColumns: flattenHeaderColumns,
    moveLinkInColumns: moveHeaderLinkInColumns,
    moveColumn: moveHeaderColumn,
    sameLinks: sameHeaderLinks,
    onCommit,
  })
}
