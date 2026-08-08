import { COLOR } from '~/const/colors'
import { DEFAULT_TAG_MARKER } from '~/const/tag'
import useTwBelt from '~/hooks/useTwBelt'

import type { TProps } from '..'

export default function useSalon({
  color = COLOR.BLACK,
  dotSize = 2,
  dotRight = 2,
  dotTop = 0,
  dotLeft = 0,
  hashSize = 2.5,
  hashRight = 2,
  hashLeft,
  hashTop,
  iconRight = 2,
  iconTop = 0,
  iconLeft = 0,
}: TProps) {
  const { cn, rainbow, zise, margin } = useTwBelt()

  const dotSpacing = { top: dotTop, right: dotRight, left: dotLeft }
  const hashSpacing = { top: hashTop, right: hashRight, left: hashLeft }
  const iconSpacing = { top: iconTop, right: iconRight, left: iconLeft }

  return {
    defaultIcon: DEFAULT_TAG_MARKER,
    dot: cn('circle opacity-80', rainbow(color, 'bg'), zise(dotSize), margin(dotSpacing)),
    hash: cn(zise(hashSize), rainbow(color, 'fill'), margin(hashSpacing)),
    icon: cn('align-both shrink-0', margin(iconSpacing)),
  }
}
