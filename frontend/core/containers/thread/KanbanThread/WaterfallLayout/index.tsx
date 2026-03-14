/* *
 * KanbanThread
 */

import Actions from './Actions'
import Sections from './Sections'

import useSalon from '../salon/waterfall_layout'

export default function WaterfallLayout() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Actions />
      <Sections />
    </div>
  )
}
