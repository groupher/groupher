import type { FC } from 'react'

import Img from '~/Img'

import useSalon from './salon'
import type { TTrashedPost } from './spec'

type TProps = {
  item: TTrashedPost
}

const DeletedByCell: FC<TProps> = ({ item }) => {
  const s = useSalon()
  const user = item.deletedBy

  if (!user) return <div className={s.systemActor}>System</div>

  return (
    <div className={s.deletedBy}>
      <Img className={s.avatar} src={user.avatar} />
      <div className={s.nickname}>{user.nickname || user.login}</div>
    </div>
  )
}

export default DeletedByCell
