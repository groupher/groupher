import { KANBAN_LAYOUT } from '~/const/layout'
import useKanban from '../../logic/useKanban'
import useSalon from '../../salon/layout/kanban_layout'
import BgColorsSetter from './BgColorsSetter'
import GlobalLayout from './GlobalLayout'
import ItemCardLayout from './ItemCardLayout'

export default () => {
  const { kanbanLayout } = useKanban()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <GlobalLayout />

      {kanbanLayout === KANBAN_LAYOUT.CLASSIC && <ItemCardLayout />}

      <div className='mt-12' />
      <BgColorsSetter />
    </div>
  )
}
