import { values } from 'ramda'
import type { FC } from 'react'
import { ICON } from '~/config'
import EMOTION from '~/const/emotion'
import Img from '~/Img'
import type { TEmotion, TEmotionType } from '~/spec'

import { isViewerReacted } from './helper'
import useSalon, { cn } from './salon/panel'

const Trans = {
  downvote: '踩',
  beer: '啤酒',
  heart: '感谢',
  biceps: '强',
  orz: '跪了',
  confused: '狗头',
  popcorn: '吃瓜',
  pill: '药丸',
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
          <div className={s.item} key={name} onClick={() => onAction(name, viewerHasReacted)}>
            <Img className={s.icon} src={`${ICON}/emotion/${name}.png`} noLazy />
            <div className={cn(s.name, viewerHasReacted && s.nameActive)}>{Trans[name]}</div>
          </div>
        )
      })}
    </div>
  )
}

export default EmojiPanel
