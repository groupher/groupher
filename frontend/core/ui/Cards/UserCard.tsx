/*
 * cards for user
 */

import type { FC } from 'react'

import SIZE from '~/const/size'
import { cutRest } from '~/fmt'
import Img from '~/Img'
import { Link } from '~/platform'
import type { TAccount, TUser } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'
import ReportAction from '~/unit/AlertWall/ReportAction'

import useSalon from './salon/user_card'

type TProps = {
  user: TUser | TAccount
}

const UserCard: FC<TProps> = ({ user }) => {
  const s = useSalon()

  const { avatar, nickname, login, bio } = user
  const userLogin = login ?? ''

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Img
          src={avatar ?? ''}
          className={s.avatar}
          fallback={<ImgFallback user={user} className={s.avatar} size={SIZE.MEDIUM} />}
        />
        <div className={s.info}>
          <Link href={`user/${userLogin}`} navigation='router' prefetch={false} className={s.title}>
            <div className={s.nickname}>{cutRest(nickname ?? '', 12)}</div>
            <div className={s.login}>{userLogin}</div>
          </Link>
          {/* <ShortBio>{bio || '--'}</ShortBio> */}
        </div>
      </div>
      <div className={s.desc}>{cutRest(bio ?? '', 50)}</div>
      {user.id && <ReportAction target={{ type: 'USER', userId: user.id }} />}
    </div>
  )
}

export default UserCard
