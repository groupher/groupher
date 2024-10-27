import { type FC, useEffect } from 'react'

import { mockUsers } from '~/mock'

import Img from '~/Img'
import useHover from '~/hooks/useHover'

import { ACTIVE_ITMES } from './constant'

import useSalon, { cn } from '../../salon/dashboard_intros/admins_tab/admins'

type TProps = {
  onHover: (state: boolean[]) => void
  userHover: boolean[]
}

const Admins: FC<TProps> = ({ onHover, userHover }) => {
  const s = useSalon()

  const users = mockUsers(4)
  const [user1Ref, user1Hovered] = useHover<HTMLDivElement>()
  const [user2Ref, user2Hovered] = useHover<HTMLDivElement>()
  const [user3Ref, user3Hovered] = useHover<HTMLDivElement>()

  // NOTE: add onHover in devps will cause parallax effect break, don't do it
  useEffect(() => {
    onHover([user1Hovered, user2Hovered, user3Hovered])
  }, [user1Hovered, user2Hovered, user3Hovered])

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div ref={user1Ref} className={cn(s.item, (user1Hovered || userHover[0]) && s.itemActive)}>
          <Img src={users[0].avatar} className={s.avatar} />
          <div className={s.intro}>
            <div className={s.nickname}>{users[0].nickname}</div>
            <div className={s.rootLabel}>Root</div>
          </div>
        </div>

        <div ref={user2Ref} className={cn(s.item, (user2Hovered || userHover[1]) && s.itemActive)}>
          <Img src={users[1].avatar} className={s.avatar} />
          <div className={s.intro}>
            <div className={s.nickname}>{users[1].nickname}</div>
            <div className={s.desc}>
              <span className={s.num}>{ACTIVE_ITMES.user2.length}</span> 项权限
            </div>
          </div>
        </div>

        <div ref={user3Ref} className={cn(s.item, (user3Hovered || userHover[2]) && s.itemActive)}>
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
