import type { FC } from 'react'

import SIZE from '~/const/size'
import { cutRest } from '~/fmt'
import Img from '~/Img'
import type { TUser } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'

import useSalon from '../salon/user_card'

type TProps = {
  user: TUser
}

const StaticUserCard: FC<TProps> = ({ user }) => {
  const s = useSalon()
  const { avatar, nickname, login, bio } = user

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Img
          src={avatar ?? ''}
          className={s.avatar}
          fallback={<ImgFallback user={user} className={s.avatar} size={SIZE.MEDIUM} />}
        />
        <div className={s.info}>
          <div className={s.title}>
            <div className={s.nickname}>{cutRest(nickname ?? '', 12)}</div>
            <div className={s.login}>{login ?? ''}</div>
          </div>
        </div>
      </div>
      <div className={s.desc}>{cutRest(bio ?? '', 50)}</div>
    </div>
  )
}

export default StaticUserCard
