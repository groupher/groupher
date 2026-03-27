import type { FC } from 'react'
import Img from '~/Img'
import type { TUser } from '~/spec'

import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../salon/user_list'

type TProps = {
  users: readonly TUser[]
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
          fallback={<ImgFallback user={user} />}
        />
      ))}
    </div>
  )
}

export default UserList
