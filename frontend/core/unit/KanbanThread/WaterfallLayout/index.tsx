/* *
 * KanbanThread
 */

import Actions from './Actions'
import useSalon from './salon'
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
