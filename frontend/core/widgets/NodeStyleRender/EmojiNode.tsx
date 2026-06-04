'use client'

import NextImage from 'next/image'
import type { FC } from 'react'

import type { TNodeStyleEmojiValue } from '~/spec'
import { getTwemojiSrc } from '~/utils/icons'

type TProps = {
  value: TNodeStyleEmojiValue
  size: number
  className?: string
}

const EmojiNode: FC<TProps> = ({ value, size, className }) => {
  return (
    <NextImage
      src={getTwemojiSrc(value.unified)}
      width={size}
      height={size}
      alt=''
      unoptimized
      draggable={false}
      className={className}
    />
  )
}

export default EmojiNode
