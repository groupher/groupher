import { type FC, useEffect, useRef } from 'react'

import KanbanList from './KanbanList'

import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter/classic_layout'

type TProps = {
  isBoard1Hovered: boolean
  isBoard2Hovered: boolean
  isBoard3Hovered: boolean
}

const ClassicLayout: FC<TProps> = ({ isBoard1Hovered, isBoard2Hovered, isBoard3Hovered }) => {
  const s = useSalon()

  const ref = useRef(null)

  /*
   * reset when content visible
   * scroll to top always
   */
  useEffect(() => {
    if (ref?.current) {
      ref.current.scrollLeft += 80
    }
  }, [ref])

  return (
    <div className={s.boardsWrapper}>
      <div className={cn(s.board, s.boardTodo, isBoard1Hovered && s.todoActive)}>
        <KanbanList num={1} />
      </div>
      <div className={cn(s.board, s.boardWip, isBoard2Hovered && s.wipActive)}>
        <KanbanList num={2} />
      </div>
      <div className={cn(s.board, s.boardDone, isBoard3Hovered && s.doneActive)}>
        <KanbanList num={3} />
      </div>
    </div>
  )
}

export default ClassicLayout
