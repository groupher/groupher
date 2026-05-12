import { type ReactNode } from 'react'

import type { TLinkItem } from '~/spec'

import SortableDndContext from '../../LinkEditor/Dnd/SortableDndContext'
import {
  FOOTER_DND_CONTEXT_ID,
  FOOTER_DND_TYPE,
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
} from './constants'
import type { TFooterColumn, TFooterDragTarget } from './spec'
import useFooterLinkDnd from './useFooterLinkDnd'

type TRenderProps = {
  activeDragColumnId: string | null
  columns: TFooterColumn[]
  targetDragColumnId: string | null
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  links: readonly TLinkItem[]
  onCommit: (links: readonly TLinkItem[]) => void
}

export default function FooterDndContext({ children, links, onCommit }: TProps) {
  const dndController = useFooterLinkDnd({
    links,
    onCommit,
  })

  return (
    <SortableDndContext<TFooterColumn, TFooterDragTarget>
      contextId={FOOTER_DND_CONTEXT_ID}
      controller={dndController}
      dndType={{ link: FOOTER_DND_TYPE.LINK, column: FOOTER_DND_TYPE.COLUMN }}
      announcements={DND_ANNOUNCEMENTS}
      measuring={DND_MEASURING}
    >
      {children}
    </SortableDndContext>
  )
}
