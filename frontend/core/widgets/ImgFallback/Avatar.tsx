import type { FC } from 'react'
import SIZE from '~/const/size'
import { getLetterColor } from '~/utils/color'

import type { TAvatarProps as TProps } from '.'
import useSalon, { cn } from './salon/avatar'

const Avatar: FC<TProps> = ({
  testid = 'avatar-fallback',
  className = '',
  size = SIZE.SMALL, // ✅ 默认用常量
  title = '',
  user = {},
  _quote = false,
  ...spacing
}) => {
  const s = useSalon({ size, ...spacing })

  const name = user?.login || title || '?'
  const sliceCount = size === SIZE.SMALL ? 1 : 2
  const color = getLetterColor(name)

  return (
    <div data-testid={testid} className={cn(className, s.wrapper, s.rainbowSoft(color))}>
      <div className={cn(s.name, s.rainbow(color, 'fg'))}>{name.slice(0, sliceCount)}</div>
    </div>
  )
}

export default Avatar
