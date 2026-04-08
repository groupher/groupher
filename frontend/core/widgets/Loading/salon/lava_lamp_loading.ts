import useTwBelt from '~/hooks/useTwBelt'

import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, primary } = useTwBelt()

  return {
    wrapper: cn('w-20 h-5', margin(spacing)),
    container: 'row-center h-full w-full relative',
    circle: cn('size-1 circle mr-0.5', primary('bg')),
    tiny: 'w-1',
    speedMap: {
      0: 0.8,
      1: 1,
      2: 1.2,
      3: 2,
      4: 0.6,
      5: 0.8,
      6: 1.6,
      7: 0.8,
      8: 0.3,
      9: 0.3,
    },
  }
}
