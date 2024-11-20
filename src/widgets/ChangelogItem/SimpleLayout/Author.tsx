import type { FC } from 'react'

import type { TUser } from '~/spec'

import Img from '~/Img'

import useSalon from '../salon/classic_layout/author'

type TProps = {
  user: TUser
}

const Author: FC<TProps> = ({ user }) => {
  const s = useSalon()
  const { avatar, nickname } = user

  return (
    <div className={s.wrapper}>
      <Img src={avatar} />
      <div className={s.name}>{nickname}</div>
    </div>
  )
}

export default Author
