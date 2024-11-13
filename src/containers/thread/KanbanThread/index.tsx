/* *
 * KanbanThread
 *
 */

import useLayout from '~/hooks/useLayout'
import { KANBAN_LAYOUT } from '~/const/layout'

import WaterfallLayout from './WaterfallLayout'
import ClassicLayout from './ClassicLayout'

import useSalon from './styles'

export default () => {
  const s = useSalon()
  const { kanbanLayout } = useLayout()

  return (
    <div className={s.wrapper}>
      {kanbanLayout === KANBAN_LAYOUT.WATERFALL ? <WaterfallLayout /> : <ClassicLayout />}
    </div>
  )
}
