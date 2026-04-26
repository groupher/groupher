/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'

import type { TEmotion, TEmotionType } from '~/spec'
import IconButton from '~/widgets/Buttons/IconButton'
import Tooltip from '~/widgets/Tooltip'

import { ensureEmotion, visibleEmotions } from './helper'
import Panel from './Panel'
import useSalon from './salon'
import SelectedEmotions from './SelectedEmotions'

type TProps = {
  isLegal?: boolean
  emotions?: TEmotion[]
  onAction?: (name: TEmotionType, hasReacted: boolean) => void
}

const EmotionSelector: FC<TProps> = ({ onAction = console.log, isLegal = true, emotions }) => {
  const s = useSalon()
  const preparedEmotions = ensureEmotion(emotions)
  const selectedEmotions = visibleEmotions(preparedEmotions)

  return (
    <>
      <SelectedEmotions emotions={selectedEmotions} onAction={onAction} />
      {isLegal && (
        <Tooltip
          content={<Panel emotions={preparedEmotions} onAction={onAction} />}
          trigger='click'
          noPadding
        >
          <div className={s.selectEmotion}>
            <IconButton icon='emotion' dimWhenIdle size={18} />
          </div>
        </Tooltip>
      )}
    </>
  )
}

export default memo(EmotionSelector)
