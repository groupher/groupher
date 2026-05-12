import { useMemo } from 'react'

import type { TLinkItem } from '~/spec'

import useSortableDraft from '../../LinkEditor/Dnd/useSortableDraft'
import {
  buildFooterColumns,
  findColumnWithLink,
  flattenFooterColumns,
  moveFooterLinkInColumns,
  sameFooterLinks,
} from './model'
import type { TFooterColumn, TFooterDraftLink, TFooterDragTarget } from './spec'

type TProps = {
  links: readonly TLinkItem[]
  onCommit: (links: readonly TLinkItem[]) => void
}

type TRet = {
  columns: TFooterColumn[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findColumnWithLink>
  startDrag: (itemId: string) => void
  moveDrag: (target?: TFooterDragTarget | null) => void
  commitDrag: (target?: TFooterDragTarget | null) => void
  cancelDrag: () => void
}

export default function useFooterLinkDnd({ links, onCommit }: TProps): TRet {
  const sourceColumns = useMemo(() => buildFooterColumns(links), [links])

  return useSortableDraft<TFooterColumn, TFooterDraftLink, TFooterDragTarget, TLinkItem>({
    sourceColumns,
    findColumnWithLink,
    flattenColumns: flattenFooterColumns,
    moveLinkInColumns: moveFooterLinkInColumns,
    sameLinks: sameFooterLinks,
    onCommit,
  })
}
