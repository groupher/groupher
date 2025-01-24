/* *
 * KanbanThread
 */

import Actions from './Actions'
import Columns from './Columns'

import useSalon from '../salon/classic_layout'

export default () => {
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
