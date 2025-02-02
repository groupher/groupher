/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'

import type { TEmotion, TSimpleUser, TEmotionType } from '~/spec'

import { titleCase } from '~/fmt'
import Tooltip from '~/widgets/Tooltip'
import AnimatedCount from '~/widgets/AnimatedCount'

import EmotionIcon from './EmotionIcon'
import UsersPanel from './UsersPanel'

import { getEmotionName } from '../helper'

import useSalon from '../salon/selected_emotions/emotion_unit'

type TProps = {
  item: TEmotion
  onAction?: (name: TEmotionType, hasEmotioned: boolean) => void
}

const EmotionUnit: FC<TProps> = ({ item, onAction }) => {
  const s = useSalon()

  const name = getEmotionName(item)
  const count = item[`${name}Count`] as number
  const users = item[`latest${titleCase(name)}Users`] as TSimpleUser[]
  const hasEmotioned = item[`viewerHas${titleCase(name)}ed`] as boolean

  return (
    <Tooltip
      content={<UsersPanel name={name} count={count} users={users} />}
      interactive={false}
      noPadding
    >
      <div className={s.wrapper} onClick={() => onAction(name as TEmotionType, hasEmotioned)}>
        <EmotionIcon name={name} />
        <div className={s.count}>
          <AnimatedCount count={count} size="small" active={hasEmotioned} />
        </div>
      </div>
    </Tooltip>
  )
}

export default memo(EmotionUnit)
