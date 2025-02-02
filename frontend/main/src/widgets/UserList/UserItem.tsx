import type { FC } from 'react'

import type { TUser } from '~/spec'

import Img from '~/Img'

import { assetSrc } from '~/helper'
import useSalon from './salon/user_item'

type TProps = {
  user: TUser
}

const UserItem: FC<TProps> = ({ user }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Img src={assetSrc(user.avatar)} className={s.avatar} />
      <div className={s.main}>
        <div className={s.header}>
          <div className={s.title}>{user.nickname}</div>
          <div className={s.login}>{user.login}</div>
        </div>
        <div className={s.bio}>{user.bio}</div>
      </div>
    </div>
  )
}

export default UserItem
