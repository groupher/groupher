import { type FC, memo } from 'react'
import { KANBAN_CARD_LAYOUT } from '~/const/layout'

import KanbanItem from './KanbanItem'

type TProps = {
  layout: (typeof KANBAN_CARD_LAYOUT)[keyof typeof KANBAN_CARD_LAYOUT]
  num: number
}

const KanbanList: FC<TProps> = ({ num, layout }) => {
  switch (num) {
    case 1: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-24'} />
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }
    case 2: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-28'} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }
    case 3: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-32'} />
          <KanbanItem layout={layout} width={'w-16'} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }
    case 4: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-24'} />
          <KanbanItem layout={layout} width={'w-20'} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }
    case 5: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-28'} />
          <KanbanItem layout={layout} width={'w-16'} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }

    default: {
      return (
        <>
          <KanbanItem layout={layout} />
          <KanbanItem layout={layout} width={'w-32'} />
          <KanbanItem layout={layout} width={'w-16'} />
          <KanbanItem layout={layout} opacity='opacity-80' />
          <KanbanItem layout={layout} opacity='opacity-60' />
        </>
      )
    }
  }
}

export default memo(KanbanList)
