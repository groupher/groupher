import { useMemo } from 'react'

import type { TLinkItem } from '~/spec'

import useSortableDraft from '../../LinkEditor/Dnd/useSortableDraft'
import {
  buildFooterColumns,
  findColumnWithLink,
  flattenFooterColumns,
  moveFooterColumn,
  moveFooterLinkInColumns,
  sameFooterLinks,
} from './model'
import type { TFooterColumn, TFooterDraftLink, TFooterDragTarget } from './spec'

type TProps = {
  links: readonly TLinkItem[]
  onCommit: (links: readonly TLinkItem[]) => void
  enableColumnSorting?: boolean
}

type TRet = {
  columns: TFooterColumn[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findColumnWithLink>
  startDrag: (itemId: string) => void
  moveDrag: (target?: TFooterDragTarget | null) => void
  commitDrag: (target?: TFooterDragTarget | null) => void
  cancelDrag: () => void
}

// Wires footer-specific column adapters into the shared DnD draft controller.
// `enableColumnSorting` is only true for grouped footer layout; oneline has a
// synthetic single group and should only sort links inside that group.
export default function useFooterLinkDnd({
  links,
  onCommit,
  enableColumnSorting = false,
}: TProps): TRet {
  const sourceColumns = useMemo(() => buildFooterColumns(links), [links])

  return useSortableDraft<TFooterColumn, TFooterDraftLink, TFooterDragTarget, TLinkItem>({
    sourceColumns,
    findColumnWithLink,
    flattenColumns: flattenFooterColumns,
    moveLinkInColumns: moveFooterLinkInColumns,
    moveColumn: enableColumnSorting ? moveFooterColumn : undefined,
    sameLinks: sameFooterLinks,
    onCommit,
  })
}
