/*
 *
 * AdminAvatar
 *
 */

import type { FC } from 'react'

import type { TUser, TSpace } from '~/spec'

import Img from '~/Img'
import ImgFallback from '~/widgets/ImgFallback'
import AdminStarSVG from '~/icons/AdminStar'

import useSalon from './salon'

type TProps = {
  testid?: string
  user: TUser
} & TSpace

const AdminAvatar: FC<TProps> = ({ testid = 'admin-avatar', user, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <div className={s.innerWrapper}>
        <Img
          className={s.avatar}
          src={user.avatar}
          fallback={<ImgFallback size={10} user={user} />}
        />
        <div className={s.badge}>
          <AdminStarSVG className={s.starIcon} />
        </div>
      </div>
    </div>
  )
}

export default AdminAvatar
