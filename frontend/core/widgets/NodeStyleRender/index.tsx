'use client'

import type { FC } from 'react'

import type { TNodeStyleValue } from '~/spec'
import IconHub from '~/widgets/IconHub'

type TProps = {
  value: TNodeStyleValue
  size?: number
  className?: string
  iconClassName?: string
  emojiClassName?: string
}

const TWEMOJI_VERSION = '14.0.2'

const NodeStyleRender: FC<TProps> = ({
  value,
  size = 20,
  className,
  iconClassName,
  emojiClassName,
}) => {
  if (value.type === 'emoji') {
    return (
      <img
        src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@${TWEMOJI_VERSION}/assets/svg/${value.unified}.svg`}
        width={size}
        height={size}
        alt=''
        draggable={false}
        className={emojiClassName ?? className}
      />
    )
  }

  return (
    <IconHub
      provider={value.provider}
      icon={value.name}
      size={size / 4}
      className={iconClassName ?? className}
    />
  )
}

export default NodeStyleRender
