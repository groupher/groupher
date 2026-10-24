/*
 * EmojiSelector
 */

import { type FC, memo } from 'react'

import type { TEmotion, TEmotionType } from '~/spec'
import IconButton from '~/ui/Buttons/IconButton'
import Tooltip from '~/ui/Tooltip'

import { ensureEmotion, visibleEmotions } from './helper'
import Panel from './Panel'
import useSalon from './salon'
import SelectedEmotions from './SelectedEmotions'

type TProps = {
  emotions?: TEmotion[]
  onAction?: (name: TEmotionType, hasReacted: boolean) => void
}

const EmotionSelector: FC<TProps> = ({ onAction = console.log, emotions }) => {
  const s = useSalon()
  const preparedEmotions = ensureEmotion(emotions)
  const selectedEmotions = visibleEmotions(preparedEmotions)

  return (
    <>
      <SelectedEmotions emotions={selectedEmotions} onAction={onAction} />
      <Tooltip
        content={<Panel emotions={preparedEmotions} onAction={onAction} />}
        trigger='click'
        noPadding
      >
        <div className={s.selectEmotion}>
          <IconButton icon='emotion' dimWhenIdle size={18} />
        </div>
      </Tooltip>
    </>
  )
}

export default memo(EmotionSelector)
