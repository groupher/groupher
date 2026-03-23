import type { FC } from 'react'

import { mockUsers } from '~/mock'
import useSalon from './salon'
import UserItem from './UserItem'

const UserList: FC = () => {
  const s = useSalon()

  const users = mockUsers(18)

  return (
    <div className={s.wrapper}>
      {users.map((user) => (
        <UserItem key={user.login} user={user} />
      ))}
    </div>
  )
}

export default UserList
