'use client'

import type { FC } from 'react'

import type { TMarkerEmojiValue } from '~/spec'
import { getTwemojiSrc } from '~/utils/icons'

type TProps = {
  value: TMarkerEmojiValue
  size: number
  className?: string
}

const EmojiNode: FC<TProps> = ({ value, size, className }) => {
  const pixelSize = size * 4

  return (
    <img
      src={getTwemojiSrc(value.unified)}
      width={pixelSize}
      height={pixelSize}
      alt=''
      draggable={false}
      className={className}
    />
  )
}

export default EmojiNode
