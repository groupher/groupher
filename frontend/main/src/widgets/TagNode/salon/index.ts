import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

import type { TProps } from '..'

export default ({
  color = COLOR_NAME.BLACK,
  dotSize = 2,
  dotRight = 2,
  dotTop = 0,
  dotLeft = 0,
  hashSize = 2.5,
  hashRight = 2,
  hashLeft,
  hashTop,
}: TProps) => {
  const { cn, rainbow, zise, margin } = useTwBelt()

  const dotSpacing = { top: dotTop, right: dotRight, left: dotLeft }
  const hashSpacing = { top: hashTop, right: hashRight, left: hashLeft }

  return {
    dot: cn('circle opacity-80', rainbow(color, 'bg'), zise(dotSize), margin(dotSpacing)),
    hash: cn('opacity-80', zise(hashSize), rainbow(color, 'fill'), margin(hashSpacing)),
  }
}
