/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'
import type { TEmotion, TEmotionType, TSimpleUser } from '~/spec'
import AnimatedCount from '~/widgets/AnimatedCount'
import Tooltip from '~/widgets/Tooltip'
import { getEmotionName } from '../helper'
import useSalon from '../salon/selected_emotions/emotion_unit'
import EmotionIcon from './EmotionIcon'
import UsersPanel from './UsersPanel'

type TProps = {
  item: TEmotion
  onAction?: (name: TEmotionType, hasReacted: boolean) => void
}

const EmotionUnit: FC<TProps> = ({ item, onAction }) => {
  const s = useSalon()

  const name = getEmotionName(item)
  const count = item.count || 0
  const users = (item.latestUsers || []) as TSimpleUser[]
  const hasReacted = Boolean(item.viewerHasReacted)

  return (
    <Tooltip
      content={<UsersPanel name={name} count={count} users={users} />}
      interactive={false}
      noPadding
    >
      <div className={s.wrapper} onClick={() => onAction(name as TEmotionType, hasReacted)}>
        <EmotionIcon name={name} />
        <div className={s.count}>
          <AnimatedCount count={count} size='small' active={hasReacted} />
        </div>
      </div>
    </Tooltip>
  )
}

export default memo(EmotionUnit)
