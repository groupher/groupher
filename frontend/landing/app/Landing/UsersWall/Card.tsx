import type { FC, ReactNode } from 'react'

import type { TColorName, TUser } from '~/spec'

import useSalon from '../salon/users_wall/card'

type TProps = {
  content: ReactNode
  color: TColorName
  user: TUser
}

const Card: FC<TProps> = ({ content, user, color }) => {
  const s = useSalon({ color })

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <img className={s.avatar} src={user.avatar} color={color} alt='user' />
        <div className={s.nickname}>{user.nickname}</div>
      </div>
      <div className={s.content}>{content}</div>
    </div>
  )
}

export default Card
