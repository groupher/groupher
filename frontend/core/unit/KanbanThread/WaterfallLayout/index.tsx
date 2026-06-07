/* *
 * KanbanThread
 */

import useSalon from './salon'
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
