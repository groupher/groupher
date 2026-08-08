import { cn } from '~/css'
import { cachedMargin } from '~/hooks/useTwBelt/constant'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  return {
    wrapper: cn('w-20 h-5', cachedMargin(spacing)),
    container: 'row-center s-full relative',
    circle: 'size-1 circle mr-0.5 bg-rainbow-custom',
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
