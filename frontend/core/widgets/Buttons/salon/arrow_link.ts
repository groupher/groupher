import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSize } from '~/spec'

import { getIconSize, getTextSize } from './metrics/arrow_link'

export { cn } from '~/css'

type TProps = {
  size?: TSize
  color?: string
}

export default function useSalon({ size, color }: TProps) {
  const { accent, cn, rainbow, underline } = useTwBelt()

  return {
    wrapper: cn(
      'row-center group w-fit pointer no-underline rounded-sm outline-none',
      'focus-visible:outline-2 focus-visible:outline-offset-2',
    ),
    text: cn(
      color ? rainbow(color as TColorName, 'fg') : accent('fg'),
      getTextSize(size),
      underline({ groupHoverClass: 'group-hover' }),
    ),
    rightIcon: cn(
      'ml-1.5 rotate-180 opacity-80 shrink-0 transition-transform duration-150 ease-out',
      getIconSize(size),
      color ? rainbow(color as TColorName, 'fill') : accent('fill'),
      'group-hover:translate-x-0.5',
    ),
  }
}
