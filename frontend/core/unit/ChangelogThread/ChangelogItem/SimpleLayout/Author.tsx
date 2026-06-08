import type { FC } from 'react'

import Img from '~/Img'
import type { TUser } from '~/spec'

import useSalon from '../ClassicLayout/salon/author'

type TProps = {
  user: TUser
}

const Author: FC<TProps> = ({ user }) => {
  const s = useSalon()
  const { avatar, nickname } = user

  return (
    <div className={s.wrapper}>
      <Img src={avatar} className={s.avatar} />
      <div className={s.name}>{nickname}</div>
    </div>
  )
}

export default Author
