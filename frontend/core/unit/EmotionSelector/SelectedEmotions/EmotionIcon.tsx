import { type FC, memo } from 'react'

import Img from '~/Img'
import type { TEmotionType } from '~/spec'

import useSalon from '../salon/selected_emotions/emotion_icon'

type TProps = {
  name: TEmotionType
}

const EMOTION_ICON: Partial<Record<TEmotionType, string>> = {
  orz: 'pao',
}

const EmotionIcon: FC<TProps> = ({ name }) => {
  const s = useSalon()
  const iconName = EMOTION_ICON[name] || name

  return <Img src={`/icons/emotion/${iconName}.png`} className={s.icon} noLazy />
}

export default memo(EmotionIcon)
