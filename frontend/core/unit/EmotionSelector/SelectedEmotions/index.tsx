/*
 * EmojiSelector
 */

import { type FC, Fragment } from 'react'

import type { TEmotion, TEmotionType } from '~/spec'

import { getEmotionName } from '../helper'
import EmotionUnit from './EmotionUnit'

type TProps = {
  emotions: TEmotion[]
  onAction?: (name: TEmotionType, hasReacted: boolean) => void
}

const SelectedEmotions: FC<TProps> = ({ emotions, onAction }) => {
  return (
    <Fragment>
      {emotions.map((item) => {
        const name = getEmotionName(item) as string

        return <EmotionUnit key={name} item={item} onAction={onAction} />
      })}
    </Fragment>
  )
}

export default SelectedEmotions
