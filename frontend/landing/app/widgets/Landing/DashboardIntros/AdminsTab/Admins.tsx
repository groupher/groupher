import type { FC } from 'react'

import Img from '~/Img'
import { mockUsers } from '~/mock'

import useSalon, { cn } from '../../salon/dashboard_intros/admins_tab/admins'
import { ACTIVE_ITMES } from './constant'

type TProps = {
  onHover: (state: boolean[]) => void
  userHover: boolean[]
}

const Admins: FC<TProps> = ({ onHover, userHover }) => {
  const s = useSalon()

  const users = mockUsers(4)
  const handleLeave = () => onHover([false, false, false])

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div
          className={cn(s.item, userHover[0] && s.itemActive)}
          onPointerEnter={() => onHover([true, false, false])}
          onPointerLeave={handleLeave}
        >
          <Img src={users[0].avatar} className={s.avatar} />
          <div className={s.intro}>
            <div className={s.nickname}>{users[0].nickname}</div>
            <div className={s.rootLabel}>Root</div>
          </div>
        </div>

        <div
          className={cn(s.item, userHover[1] && s.itemActive)}
          onPointerEnter={() => onHover([false, true, false])}
          onPointerLeave={handleLeave}
        >
          <Img src={users[1].avatar} className={s.avatar} />
          <div className={s.intro}>
            <div className={s.nickname}>{users[1].nickname}</div>
            <div className={s.desc}>
              <span className={s.num}>{ACTIVE_ITMES.user2.length}</span> 项权限
            </div>
          </div>
        </div>

        <div
          className={cn(s.item, userHover[2] && s.itemActive)}
          onPointerEnter={() => onHover([false, false, true])}
          onPointerLeave={handleLeave}
        >
          <Img src={users[2].avatar} className={s.avatar} />
          <div className={s.intro}>
            <div className={s.nickname}>{users[2].nickname}</div>
            <div className={s.desc}>
              <span className={s.num}>{ACTIVE_ITMES.user3.length}</span> 项权限
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admins
