import { values } from 'ramda'
import type { FC } from 'react'

import { ICON } from '~/config'
import EMOTION from '~/const/emotion'
import Img from '~/Img'
import type { TEmotion, TEmotionType } from '~/spec'

import { isViewerReacted } from './helper'
import useSalon, { cn } from './salon/panel'

const Trans = {
  DOWNVOTE: '踩',
  BEER: '啤酒',
  HEART: '感谢',
  BICEPS: '强',
  ORZ: '跪了',
  CONFUSED: '狗头',
  POPCORN: '吃瓜',
  PILL: '药丸',
}

type TProps = {
  emotions: TEmotion[]
  onAction?: (name: TEmotionType, hasReacted: boolean) => void
}

const EmojiPanel: FC<TProps> = ({ emotions, onAction }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {values(EMOTION).map((name) => {
        const viewerHasReacted = isViewerReacted(emotions, name)

        return (
          <button
            type='button'
            className={s.item}
            key={name}
            onClick={() => onAction?.(name, viewerHasReacted)}
          >
            <Img className={s.icon} src={`${ICON}/emotion/${name.toLowerCase()}.png`} noLazy />
            <div className={cn(s.name, viewerHasReacted && s.nameActive)}>{Trans[name]}</div>
          </button>
        )
      })}
    </div>
  )
}

export default EmojiPanel
