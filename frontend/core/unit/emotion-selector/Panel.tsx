import { values } from 'ramda'
import type { FC } from 'react'
import { ICON } from '~/config'
import EMOTION from '~/const/emotion'
import Img from '~/Img'
import type { TEmotion, TEmotionType } from '~/spec'

import { isViewerEmotioned } from './helper'
import useSalon, { cn } from './salon/panel'

const Trans = {
  downvote: '踩',
  beer: '啤酒',
  heart: '感谢',
  confused: '狗头',
  popcorn: '吃瓜',
  pill: '药丸',
}

type TProps = {
  emotions: TEmotion[]
  onAction?: (name: TEmotionType, hasEmotioned: boolean) => void
}

const EmojiPanel: FC<TProps> = ({ emotions, onAction }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {values(EMOTION).map((name) => {
        const viewerHasEmotioned = isViewerEmotioned(emotions, name)

        return (
          <div className={s.item} key={name} onClick={() => onAction(name, viewerHasEmotioned)}>
            <Img className={s.icon} src={`${ICON}/emotion/${name}.png`} noLazy />
            <div className={cn(s.name, viewerHasEmotioned && s.nameActive)}>{Trans[name]}</div>
          </div>
        )
      })}
    </div>
  )
}

export default EmojiPanel
