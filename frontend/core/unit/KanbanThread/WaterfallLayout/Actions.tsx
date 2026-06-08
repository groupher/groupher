import KanbanSVG from '~/icons/Kanban'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile'

import useSalon from './salon/actions'

export default function Actions() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className='row-center'>
        <KanbanSVG className={s.kanbanIcon} />
        <h3 className={s.title}>
          看板墙
          <div className={s.count}>23</div>
        </h3>
      </div>
      <div className='row-center'>
        <div className={s.joinTitle}>参与者</div>
        <Facepile size='medium' users={mockUsers(6)} total={20} />
      </div>
    </div>
  )
}
