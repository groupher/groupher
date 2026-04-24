import { KANBAN_LAYOUT } from '~/const/layout'
import useKanban from '../../logic/useKanban'
import useSalon from '../../salon/layout/kanban_layout'
import BgColorsSetter from './BgColorsSetter'
import Boards from './Boards'
import KanbanLayoutSelector from './KanbanLayoutSelector'
import ItemCardLayout from './ItemCardLayout'

export default function KanbanLayout() {
  const { kanbanLayout } = useKanban()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Boards />
      <div className='mt-12' />
      <KanbanLayoutSelector />

      {kanbanLayout === KANBAN_LAYOUT.CLASSIC && <ItemCardLayout />}

      <div className='mt-12' />
      <BgColorsSetter />
    </div>
  )
}
