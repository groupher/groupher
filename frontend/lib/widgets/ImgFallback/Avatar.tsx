/*
 *
 * ImgFallback for avatar
 *
 */

import type { FC } from 'react'

import { getLetterColor } from '~/utils/color'

import type { TAvatarProps as TProps } from '.'
import useSalon, { cn } from './salon/avatar'

const Avatar: FC<TProps> = ({
  testid = 'avatar-fallback',
  className = '',
  size = 4,
  title = '',
  user = {},
  quote = false,
  ...spacing
}) => {
  const s = useSalon({ size, ...spacing })

  const name = user?.login || title || '?'
  const sliceCount = size >= 4 ? 2 : 1

  const color = getLetterColor(name)

  return (
    <div className={cn(className, s.wrapper, s.rainbowSoft(color))}>
      <div className={cn(s.name, s.rainbow(color, 'fg'))}>{name.slice(0, sliceCount)}</div>
    </div>
  )
}

export default Avatar
