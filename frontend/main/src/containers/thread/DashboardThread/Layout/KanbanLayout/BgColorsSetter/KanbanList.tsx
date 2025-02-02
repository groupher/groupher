import { type FC, memo } from 'react'

import KanbanItem from './KanbanItem'

type TProps = {
  num: number
}

const KanbanList: FC<TProps> = ({ num }) => {
  switch (num) {
    case 1: {
      return (
        <>
          <KanbanItem />
          <KanbanItem width={'w-24'} />
          <KanbanItem />
          <KanbanItem opacity="opacity-80" />
          <KanbanItem opacity="opacity-60" />
        </>
      )
    }
    case 2: {
      return (
        <>
          <KanbanItem />
          <KanbanItem />
          <KanbanItem width={'w-28'} />
          <KanbanItem opacity="opacity-80" />
          <KanbanItem opacity="opacity-60" />
        </>
      )
    }

    default: {
      return (
        <>
          <KanbanItem />
          <KanbanItem width={'w-32'} />
          <KanbanItem width={'w-16'} />
          <KanbanItem opacity="opacity-80" />
          <KanbanItem opacity="opacity-60" />
        </>
      )
    }
  }
}

export default memo(KanbanList)
