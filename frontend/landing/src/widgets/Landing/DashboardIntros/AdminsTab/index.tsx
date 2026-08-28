import { useState } from 'react'

import useSalon from '../../salon/dashboard_intros/admins_tab'
import Admins from './Admins'
import ContentCard from './ContentCard'

export default function AdminsTab() {
  const s = useSalon()
  const [userHover, setUserHover] = useState([false, true, false])

  return (
    <div className={s.wrapper}>
      <Admins
        onHover={(hover) => {
          if (!hover[0] && !hover[1] && !hover[2]) return setUserHover([false, true, false])
          setUserHover(hover)
        }}
        userHover={userHover}
      />
      <ContentCard userHover={userHover} />
      <div className={s.notes}>
        原子化的<span className={s.highlight}>ABAC</span>权限控制策略，灵活精确，符合直觉。
      </div>
    </div>
  )
}
