import { type FC, useState } from 'react'
import SettingSVG from '~/icons/Setting'
import type { TSpace, TUser } from '~/spec'
import Drawer from '~/widgets/Drawer'
import Facepile from '~/widgets/Facepile'
import useSalon from './salon/admin_list'

type TProps = {
  title?: string
  userList?: TUser[]
} & TSpace

const AdminList: FC<TProps> = ({ title = '参与管理', userList, ...spacing }) => {
  const s = useSalon({ ...spacing })
  const [showDrawer, setShowDrawer] = useState(false)

  if (!userList || userList.length === 0) {
    return null
  }

  return (
    <div className={s.wrapper}>
      <Drawer show={showDrawer} onClose={() => setShowDrawer(false)}>
        <h2>管理员列表，设置</h2>
      </Drawer>

      <div className={s.header}>
        <div className={s.title}>{title}</div>
        <button className={s.iconBox} onClick={() => setShowDrawer(true)}>
          <SettingSVG
            className={s.icon}
            onClick={() => {
              console.log('## call the drawer')
            }}
          />
        </button>
      </div>
      <div className={s.list}>
        <Facepile users={userList} size='medium' showMore={false} />
      </div>
    </div>
  )
}

export default AdminList
