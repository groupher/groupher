import { type FC, useEffect, useRef } from 'react'
import { KANBAN_BOARD } from '~/const/thread'
import type { TKanbanBoard } from '~/spec'
import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter/classic_layout'
import KanbanList from './KanbanList'

type TProps = {
  activeBoards: readonly TKanbanBoard[]
  hoveredBoard: string | null
}

const BOARD_STYLE_KEY = {
  [KANBAN_BOARD.BACKLOG]: 'boardBacklog',
  [KANBAN_BOARD.TODO]: 'boardTodo',
  [KANBAN_BOARD.WIP]: 'boardWip',
  [KANBAN_BOARD.DONE]: 'boardDone',
  [KANBAN_BOARD.REJECTED]: 'boardRejected',
} as const

const BOARD_ACTIVE_KEY = {
  [KANBAN_BOARD.BACKLOG]: 'backlogActive',
  [KANBAN_BOARD.TODO]: 'todoActive',
  [KANBAN_BOARD.WIP]: 'wipActive',
  [KANBAN_BOARD.DONE]: 'doneActive',
  [KANBAN_BOARD.REJECTED]: 'rejectedActive',
} as const

const ClassicLayout: FC<TProps> = ({ activeBoards, hoveredBoard }) => {
  const s = useSalon(activeBoards.length)

  const ref = useRef(null)

  /*
   * reset when content visible
   * scroll to top always
   */
  useEffect(() => {
    if (ref?.current) {
      ref.current.scrollLeft += 80
    }
  }, [])

  return (
    <div className={s.boardsWrapper}>
      {activeBoards.map((board, index) => (
        <div
          key={board}
          className={cn(
            s.board,
            s[BOARD_STYLE_KEY[board]],
            hoveredBoard === board && s[BOARD_ACTIVE_KEY[board]],
          )}
        >
          <KanbanList num={index + 1} />
        </div>
      ))}
    </div>
  )
}

export default ClassicLayout
