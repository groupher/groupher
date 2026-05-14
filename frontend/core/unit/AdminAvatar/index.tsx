/*
 *
 * AdminAvatar
 *
 */

import type { FC } from 'react'

import SIZE from '~/const/size'
import AdminStarSVG from '~/icons/AdminStar'
import Img from '~/Img'
import type { TSpace, TUser } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from './salon'

type TProps = {
  testid?: string
  user: TUser
} & TSpace

const AdminAvatar: FC<TProps> = ({ testid: _testid = 'admin-avatar', user, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <div className={s.innerWrapper}>
        <Img
          className={s.avatar}
          src={user.avatar}
          fallback={<ImgFallback user={user} className={s.avatar} size={SIZE.MEDIUM} />}
        />
        <div className={s.badge}>
          <AdminStarSVG className={s.starIcon} />
        </div>
      </div>
    </div>
  )
}

export default AdminAvatar
