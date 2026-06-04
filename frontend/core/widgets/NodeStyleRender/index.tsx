'use client'

import type { FC } from 'react'

import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'

import ColorNode from './ColorNode'
import DevLogoNode from './DevLogoNode'
import EmojiNode from './EmojiNode'
import IconNode from './IconNode'

type TProps = {
  value: TNodeStyleValue
  size?: number
  className?: string
  iconClassName?: string
  devClassName?: string
  emojiClassName?: string
}

const NodeStyleRender: FC<TProps> = ({
  value,
  size = 20,
  className,
  iconClassName,
  devClassName,
  emojiClassName,
}) => {
  if (value.type === NODE_STYLE.EMOJI) {
    return <EmojiNode value={value} size={size} className={emojiClassName ?? className} />
  }

  if (value.type === NODE_STYLE.COLOR) {
    return <ColorNode value={value} size={size} className={className} />
  }

  if (value.type === NODE_STYLE.DEV) {
    return <DevLogoNode value={value} size={size} className={devClassName} />
  }

  return <IconNode value={value} size={size} className={iconClassName ?? className} />
}

export default NodeStyleRender
