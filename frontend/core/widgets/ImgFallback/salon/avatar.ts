import useTwBelt from '~/hooks/useTwBelt'
import type { TSizeSML, TSpace } from '~/spec'

import { getFontSize } from './metric/avatar'

export { cn } from '~/css'

type TProps = {
  size: TSizeSML
} & TSpace

export default function useSalon({ size, ...spacing }: TProps) {
  const { cn, rainbowSoft, margin, avatar, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'grid place-items-center border-none s-full text-center',
      margin(spacing),
      avatar(),
    ),
    name: cn('inline-flex items-center justify-center bold leading-none', getFontSize(size)),

    rainbowSoft,
    rainbow,
  }
}
