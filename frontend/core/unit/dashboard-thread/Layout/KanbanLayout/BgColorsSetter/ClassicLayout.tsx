import { type FC, useEffect, useRef } from 'react'
import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter/classic_layout'
import KanbanList from './KanbanList'

type TProps = {
  isBoard1Hovered: boolean
  isBoard2Hovered: boolean
  isBoard3Hovered: boolean
  isBoard4Hovered: boolean
  isBoard5Hovered: boolean
}

const ClassicLayout: FC<TProps> = ({
  isBoard1Hovered,
  isBoard2Hovered,
  isBoard3Hovered,
  isBoard4Hovered,
  isBoard5Hovered,
}) => {
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
  }, [])

  return (
    <div className={s.boardsWrapper}>
      <div className={cn(s.board, s.boardBacklog, isBoard1Hovered && s.backlogActive)}>
        <KanbanList num={1} />
      </div>
      <div className={cn(s.board, s.boardTodo, isBoard2Hovered && s.todoActive)}>
        <KanbanList num={2} />
      </div>
      <div className={cn(s.board, s.boardWip, isBoard3Hovered && s.wipActive)}>
        <KanbanList num={3} />
      </div>
      <div className={cn(s.board, s.boardDone, isBoard4Hovered && s.doneActive)}>
        <KanbanList num={4} />
      </div>
      <div className={cn(s.board, s.boardRejected, isBoard5Hovered && s.rejectedActive)}>
        <KanbanList num={5} />
      </div>
    </div>
  )
}

export default ClassicLayout
