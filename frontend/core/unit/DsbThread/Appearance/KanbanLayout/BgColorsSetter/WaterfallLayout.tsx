import type { FC } from 'react'

import { KANBAN_BOARD } from '~/const/thread'
import { cn } from '~/css'
import type { TKanbanBoard } from '~/spec'

import useSalon from '../salon/bg_colors_setter/waterfall_layout'

type TProps = {
  activeBoards: readonly TKanbanBoard[]
  hoveredBoard: string | null
}

const HEAD_KEY = {
  [KANBAN_BOARD.TODO]: 'bgTodo',
  [KANBAN_BOARD.WIP]: 'bgWip',
  [KANBAN_BOARD.DONE]: 'bgDone',
} as const

const ACTIVE_HEAD_KEY = {
  [KANBAN_BOARD.TODO]: 'bgTodoActive',
  [KANBAN_BOARD.WIP]: 'bgWipActive',
  [KANBAN_BOARD.DONE]: 'bgDoneActive',
} as const

const WIDTH_PATTERNS = ['w-4/12', 'w-6/12', 'w-3/12', 'w-5/12', 'w-7/12'] as const

const WaterfallLayout: FC<TProps> = ({ activeBoards, hoveredBoard }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {activeBoards.map((board, index) => (
        <div key={board}>
          <div
            className={cn(
              s.header,
              s[HEAD_KEY[board]],
              hoveredBoard === board && s[ACTIVE_HEAD_KEY[board]],
            )}
          />
          <div className={s.content}>
            <div
              className={cn(
                s.barBase,
                'h-1.5 opacity-30 saturate-0',
                'top-5 left-2',
                WIDTH_PATTERNS[index % WIDTH_PATTERNS.length],
              )}
            />
            <div className={cn(s.barBase, 'h-1.5 saturate-0 top-5 right-2 w-14 opacity-20')} />

            <div
              className={cn(
                s.barBase,
                'h-1.5 saturate-0',
                'top-10 left-2 mt-0.5 opacity-20',
                WIDTH_PATTERNS[(index + 1) % WIDTH_PATTERNS.length],
              )}
            />
            <div className={cn(s.barBase, 'h-1.5 saturate-0 top-10 right-2 w-14 opacity-15')} />

            <div
              className={cn(
                s.barBase,
                'h-1.5 saturate-0',
                'top-16 left-2 opacity-10',
                WIDTH_PATTERNS[(index + 2) % WIDTH_PATTERNS.length],
              )}
            />
            <div className={cn(s.barBase, 'h-1.5 saturate-0 top-16 right-2 w-10 opacity-10')} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default WaterfallLayout
