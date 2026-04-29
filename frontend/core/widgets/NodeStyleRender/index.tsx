'use client'

import type { FC } from 'react'

import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'
import IconHub from '~/widgets/IconHub'

import useSalon from './salon'

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
  const s = useSalon({
    color: value.type === NODE_STYLE.COLOR ? value.color : undefined,
    className,
  })

  if (value.type === NODE_STYLE.EMOJI) {
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

  if (value.type === NODE_STYLE.COLOR) {
    return (
      <span
        className={s.color}
        style={{
          width: size,
          height: size,
        }}
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
