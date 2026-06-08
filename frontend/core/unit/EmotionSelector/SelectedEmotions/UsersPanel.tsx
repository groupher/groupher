/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'

import { cutRest } from '~/fmt'
import type { TEmotionType, TSimpleUser } from '~/spec'

import EmotionIcon from './EmotionIcon'
import useSalon from './salon/users_panel'

type TProps = {
  name: TEmotionType
  count: number
  users: TSimpleUser[]
}

const UsersPanel: FC<TProps> = ({ name, count, users }) => {
  const s = useSalon()
  const showUnit = count > users.length

  return (
    <div className={s.wrapper}>
      <div className={s.users}>
        {users.slice(0, 5).map((u, index) => (
          <div className={s.username} key={u.login}>
            {cutRest(u.nickname, 12)}
            {users.length - 1 !== index ? ',' : ''}
          </div>
        ))}
        {showUnit && <div className={s.units}>等 {count} 人</div>}
      </div>{' '}
      <EmotionIcon name={name} />
    </div>
  )
}

export default memo(UsersPanel)
