import { type FC, memo } from 'react'

import Img from '~/Img'

import type { TEmotionType } from '~/spec'
import useSalon from '../salon/selected_emotions/emotion_icon'

type TProps = {
  name: TEmotionType
}

const EmotionIcon: FC<TProps> = ({ name }) => {
  const s = useSalon()

  return <Img src={`/icons/emotion/${name}.png`} className={s.icon} noLazy />
}

export default memo(EmotionIcon)
