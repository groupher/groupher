/*
 * cards for user
 */

import type { FC } from 'react'

import Link from 'next/link'
import type { TAccount, TUser } from '~/spec'

import Img from '~/Img'
import { cutRest } from '~/fmt'

import useSalon from './salon/user_card'

type TProps = {
  user: TUser | TAccount
}

const UserCard: FC<TProps> = ({ user }) => {
  const s = useSalon()

  const { avatar, nickname, login, bio } = user

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Img src={avatar} className={s.avatar} />
        <div className={s.info}>
          <Link href={`user/${login}`} prefetch={false} className={s.title}>
            <div className={s.nickname}>{cutRest(nickname, 12)}</div>
            <div className={s.login}>{login}</div>
          </Link>
          {/* <ShortBio>{bio || '--'}</ShortBio> */}
        </div>
      </div>
      <div className={s.desc}>{cutRest(bio, 50)}</div>
    </div>
  )
}

export default UserCard
