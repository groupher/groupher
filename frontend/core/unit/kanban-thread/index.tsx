/* *
 * KanbanThread
 *
 */

import { KANBAN_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import ClassicLayout from './ClassicLayout'
import useSalon from './salon'
import WaterfallLayout from './WaterfallLayout'

export default function KanbanThread() {
  const s = useSalon()
  const { kanbanLayout } = useLayout()

  return (
    <div className={s.wrapper}>
      {kanbanLayout === KANBAN_LAYOUT.WATERFALL ? <WaterfallLayout /> : <ClassicLayout />}
    </div>
  )
}
