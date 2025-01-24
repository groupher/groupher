import type { FC } from 'react'

import { mockUsers } from '~/mock'

import UserItem from './UserItem'
import useSalon from './salon'

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
