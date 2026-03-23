import { type FC, memo } from 'react'

import type { TUser } from '~/spec'

import AdminAvatar from '~/unit/admin-avatar'

import useSalon from '../salon/members/admin_member'

type TProps = {
  user: TUser
}

const AdminMember: FC<TProps> = ({ user }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <AdminAvatar user={user} right={5} top={1} />
      <div className={s.info}>
        <div className={s.name}>{user.nickname}</div>
        <div className={s.bio}>{user.bio}</div>
      </div>
    </div>
  )
}

export default memo(AdminMember)
