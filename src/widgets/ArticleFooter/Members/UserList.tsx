import type { FC } from 'react'

import type { TUser } from '~/spec'
import Img from '~/Img'

import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../salon/user_list'

type TProps = {
  users: TUser[]
}

const UserList: FC<TProps> = ({ users }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {users.map((user) => (
        <Img
          key={user.login}
          src={user.avatar}
          className={s.avatar}
          fallback={<ImgFallback size={20} user={user} />}
        />
      ))}
    </div>
  )
}

export default UserList
