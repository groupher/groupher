'use client'

import type { CSSProperties, FC } from 'react'

import { MARKER } from '~/const/marker'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TMarkerValue } from '~/spec'

import EmojiNode from './EmojiNode'
import IconNode from './IconNode'
import useSalon from './salon'

type TProps = {
  value: TMarkerValue
  size?: number
  color?: TColorName
  colorOverride?: string
  bgOverride?: string
  tone?: 'primary' | 'digest'
  opacity?: number
  className?: string
}

const MarkerRender: FC<TProps> = ({
  value,
  size = 5,
  color,
  colorOverride,
  bgOverride,
  tone = 'primary',
  opacity,
  className,
}) => {
  const s = useSalon({ className })
  const { theme } = useTheme()
  const { bg, fg, primary, rainbow } = useTwBelt()
  const appearanceBg = bgOverride ?? (color ? undefined : value.appearance?.[theme].bg)
  const appearanceColor =
    colorOverride ??
    (!color && value.type === MARKER.ICON ? value.appearance?.[theme].color : undefined)
  const wrapperStyle: CSSProperties | undefined =
    opacity == null && !appearanceBg ? undefined : { opacity, backgroundColor: appearanceBg }
  const iconColorClass = color
    ? rainbow(color, 'bg')
    : tone === 'digest'
      ? bg('digest')
      : primary('bg')
  const strokeIconClass = color
    ? rainbow(color, 'fg')
    : tone === 'digest'
      ? fg('digest')
      : primary('fg')

  if (value.type === MARKER.EMOJI) {
    return (
      <span className={s.wrapper} style={wrapperStyle}>
        <EmojiNode value={value} size={size} className={s.emoji} />
      </span>
    )
  }

  return (
    <span className={s.wrapper} style={wrapperStyle}>
      <IconNode
        value={value}
        size={size}
        iconColorClass={iconColorClass}
        strokeIconClass={strokeIconClass}
        color={appearanceColor}
      />
    </span>
  )
}

export default MarkerRender
