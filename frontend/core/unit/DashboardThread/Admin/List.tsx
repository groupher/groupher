import { callPassportEditor } from '~/signal'

import useAdmins from '../logic/useAdmins'
import useSalon from '../salon/admin/list'
import UserItem from './UserItem'

export default function List() {
  const s = useSalon()
  const { moderators, activeModerator, setActiveSettingAdmin } = useAdmins()

  return (
    <div className={s.wrapper}>
      {moderators.flatMap((item) => {
        const { user } = item
        if (!user?.login) return []

        const active = user.login === activeModerator?.login

        return [
          <UserItem
            key={user.login}
            item={item}
            active={active}
            onOpen={(targetUser) => {
              setActiveSettingAdmin(targetUser)
              callPassportEditor()
            }}
          />,
        ]
      })}
    </div>
  )
}
