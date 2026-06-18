'use client'

import type { FC } from 'react'

import { MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'

import EmojiNode from './EmojiNode'
import IconNode from './IconNode'

type TProps = {
  value: TMarkerValue
  size?: number
  className?: string
  iconClassName?: string
  devClassName?: string
  emojiClassName?: string
}

const MarkerRender: FC<TProps> = ({
  value,
  size = 5,
  className,
  iconClassName,
  devClassName,
  emojiClassName,
}) => {
  if (value.type === MARKER.EMOJI) {
    return <EmojiNode value={value} size={size} className={emojiClassName ?? className} />
  }

  return (
    <IconNode
      value={value}
      size={size}
      className={
        value.provider === 'dev' ? (devClassName ?? className) : (iconClassName ?? className)
      }
    />
  )
}

export default MarkerRender
