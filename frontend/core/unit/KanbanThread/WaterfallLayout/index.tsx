/* *
 * KanbanThread
 */

import useSalon from '../salon/waterfall_layout'
import Actions from './Actions'
import Sections from './Sections'

export default function WaterfallLayout() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Actions />
      <Sections />
    </div>
  )
}
