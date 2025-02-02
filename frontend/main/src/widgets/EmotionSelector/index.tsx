/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'

import type { TEmotion, TEmotionType } from '~/spec'
import IconButton from '~/widgets/Buttons/IconButton'
import Tooltip from '~/widgets/Tooltip'

import { emotionsCoverter } from './helper'

import SelectedEmotions from './SelectedEmotions'
import Panel from './Panel'

import useSalon from './salon'

type TProps = {
  isLegal?: boolean
  emotions: TEmotion
  onAction?: (name: TEmotionType, hasEmotioned: boolean) => void
}

const EmotionSelector: FC<TProps> = ({ onAction = console.log, isLegal = true, emotions }) => {
  const s = useSalon()
  const validEmotions = emotionsCoverter(emotions)

  return (
    <>
      <SelectedEmotions emotions={validEmotions} onAction={onAction} />
      {isLegal && (
        <Tooltip
          content={<Panel emotions={validEmotions} onAction={onAction} />}
          trigger="click"
          noPadding
        >
          <div className={s.selectEmotion}>
            <IconButton icon="emotion" dimWhenIdle size={18} />
          </div>
        </Tooltip>
      )}
    </>
  )
}

export default memo(EmotionSelector)
