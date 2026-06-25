'use client'

import type { CSSProperties, FC } from 'react'

import { MARKER } from '~/const/marker'
import { cnMerge } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TMarkerValue } from '~/spec'

import EmojiNode from './EmojiNode'
import IconNode from './IconNode'

type TProps = {
  value: TMarkerValue
  size?: number
  color?: TColorName
  tone?: 'primary' | 'digest'
  opacity?: number
  className?: string
}

const MarkerRender: FC<TProps> = ({
  value,
  size = 5,
  color,
  tone = 'primary',
  opacity,
  className,
}) => {
  const { bg, primary, rainbow } = useTwBelt()
  const wrapperStyle: CSSProperties | undefined = opacity == null ? undefined : { opacity }
  const iconColorClass = color
    ? rainbow(color, 'bg')
    : tone === 'digest'
      ? bg('digest')
      : primary('bg')

  if (value.type === MARKER.EMOJI) {
    return (
      <span
        className={cnMerge('inline-flex items-center justify-center leading-none', className)}
        style={wrapperStyle}
      >
        <EmojiNode value={value} size={size} className='object-contain' />
      </span>
    )
  }

  return (
    <span
      className={cnMerge('inline-flex items-center justify-center leading-none', className)}
      style={wrapperStyle}
    >
      <IconNode value={value} size={size} iconColorClass={iconColorClass} />
    </span>
  )
}

export default MarkerRender
