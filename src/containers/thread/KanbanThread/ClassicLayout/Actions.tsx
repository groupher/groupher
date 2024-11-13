import { mockUsers } from '~/mock'

import KanbanSVG from '~/icons/Kanban'
import Facepile from '~/widgets/Facepile'

import useSalon from '../styles/classic_layout/actions'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <KanbanSVG className={s.kanbanIcon} />
        <h3 className={s.title}>
          看板墙
          <div className={s.count}>23</div>
        </h3>
      </div>
      <div className={s.right}>
        <h3 className={s.joinTitle}>参与者</h3>
        <Facepile size="medium" users={mockUsers(6)} total={20} />
      </div>
    </div>
  )
}
