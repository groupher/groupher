import useTwBelt from '~/hooks/useTwBelt'

import { getBgGradientDirAngle } from '../../../../../salon/metric'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fill } = useTwBelt()

  return {
    dirRow: 'row-center wrap gap-2',
    imageItem: cn(
      'align-both size-8 border border-transparent rounded-md opacity-90 trans-all-100',
      bg('card'),
      `hover:${br('digest')}`,
    ),
    imageItemActive: cn('opacity-100', br('digest')),
    dirItem: cn('size-7', br('divider')),
    dirArrow: cn('size-2.5', fill('digest')),
    getBgGradientDirAngle,
  }
}
