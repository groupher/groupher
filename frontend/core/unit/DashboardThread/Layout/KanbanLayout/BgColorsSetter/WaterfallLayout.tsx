import type { FC } from 'react'
import { KANBAN_BOARD } from '~/const/thread'
import type { TKanbanBoard } from '~/spec'

import useSalon, {
  cnMerge,
} from '../../../salon/layout/kanban_layout/bg_colors_setter/waterfall_layout'

type TProps = {
  activeBoards: readonly TKanbanBoard[]
  hoveredBoard: string | null
}

const HEAD_KEY = {
  [KANBAN_BOARD.BACKLOG]: 'bgTodo',
  [KANBAN_BOARD.TODO]: 'bgWip',
  [KANBAN_BOARD.WIP]: 'bgDone',
  [KANBAN_BOARD.DONE]: 'bgReview',
  [KANBAN_BOARD.REJECTED]: 'bgRejected',
} as const

const ACTIVE_HEAD_KEY = {
  [KANBAN_BOARD.BACKLOG]: 'bgTodoActive',
  [KANBAN_BOARD.TODO]: 'bgWipActive',
  [KANBAN_BOARD.WIP]: 'bgDoneActive',
  [KANBAN_BOARD.DONE]: 'bgReviewActive',
  [KANBAN_BOARD.REJECTED]: 'bgRejectedActive',
} as const

const WIDTH_PATTERNS = ['w-4/12', 'w-6/12', 'w-3/12', 'w-5/12', 'w-7/12'] as const

const WaterfallLayout: FC<TProps> = ({ activeBoards, hoveredBoard }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {activeBoards.map((board, index) => (
        <div key={board}>
          <div
            className={cnMerge(
              s.header,
              s[HEAD_KEY[board]],
              hoveredBoard === board && s[ACTIVE_HEAD_KEY[board]],
            )}
          />
          <div className={s.content}>
            <div className={cnMerge(s.bar, 'top-5 left-2', WIDTH_PATTERNS[index % WIDTH_PATTERNS.length])} />
            <div className={cnMerge(s.bar, 'top-5 right-2 w-14 opacity-20')} />

            <div
              className={cnMerge(
                s.bar,
                'top-10 left-2 mt-0.5 opacity-20',
                WIDTH_PATTERNS[(index + 1) % WIDTH_PATTERNS.length],
              )}
            />
            <div className={cnMerge(s.bar, 'top-10 right-2 w-14 opacity-15')} />

            <div
              className={cnMerge(
                s.bar,
                'top-16 left-2 opacity-10',
                WIDTH_PATTERNS[(index + 2) % WIDTH_PATTERNS.length],
              )}
            />
            <div className={cnMerge(s.bar, 'top-16 right-2 w-10 opacity-10')} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default WaterfallLayout
