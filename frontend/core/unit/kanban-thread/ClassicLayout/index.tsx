/* *
 * KanbanThread
 */

import useSalon from '../salon/classic_layout'
import Actions from './Actions'
import Columns from './Columns'

export default function ClassicLayout() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Actions />
      <div className={s.columns}>
        <Columns />
      </div>
    </div>
  )
}
