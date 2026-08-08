import SIZE from '~/const/size'
import { cnMerge } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'

import type { TColorsPresetBallSize } from '../spec'

type TProps = {
  size: TColorsPresetBallSize
  isNumericSize: boolean
  interactive: boolean
  active: boolean
}

export default function useSalon({ size, isNumericSize, interactive, active }: TProps) {
  const { br, primary } = useTwBelt()

  return {
    wrapper: cnMerge(
      'circle shrink-0',
      !isNumericSize && size === SIZE.TINY && 'size-5',
      !isNumericSize && size === SIZE.SMALL && 'size-7',
      !isNumericSize && size === SIZE.MEDIUM && 'size-9',
      !isNumericSize && size === SIZE.LARGE && 'size-10',
      !isNumericSize && size === 'full' && 's-full',
      interactive && 'p-0.5 border border-transparent pointer trans-all-200',
      interactive && active && primary('border'),
      interactive && (active ? `hover:${primary('border')}` : `hover:${br('digest')}`),
    ),
  }
}
