import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSize } from '~/spec'

import { getIconSize, getTextSize } from './metrics/arrow_link'

export { cn } from '~/css'

type TProps = {
  size?: TSize
  color?: string
}

export default function useSalon({ size, color }: TProps) {
  const { cn, fg, rainbow, fill } = useTwBelt()

  return {
    wrapper: 'row-center group pointer no-underline',
    text: cn(
      'group-hover:visible',
      color ? rainbow(color as TColorName, 'fg') : fg('link'),
      getTextSize(size),
    ),
    rightIcon: cn(
      'ml-1.5 rotate-180 opacity-80 invisible trans-all-200',
      getIconSize(size),
      color ? rainbow(color as TColorName, 'fill') : fill('link'),
      'group-hover:ml-2.5',
      'group-hover:visible',
    ),
  }
}
