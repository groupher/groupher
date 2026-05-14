import { callPassportEditor } from '~/signal'

import useAdmins from '../logic/useAdmins'
import useSalon from '../salon/admin/list'
import UserItem from './UserItem'

export default function List() {
  const s = useSalon()
  const { moderators, activeModerator, setActiveSettingAdmin } = useAdmins()

  return (
    <div className={s.wrapper}>
      {moderators
        .filter((item) => item.user?.login)
        .map((item) => {
          const { user } = item
          const active = user.login === activeModerator?.login

          return (
            <UserItem
              key={user.login}
              item={item}
              active={active}
              onOpen={(targetUser) => {
                setActiveSettingAdmin(targetUser)
                callPassportEditor()
              }}
            />
          )
        })}
    </div>
  )
}
