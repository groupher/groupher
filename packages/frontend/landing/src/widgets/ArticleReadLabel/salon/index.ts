import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  size: number
} & TSpace

export default ({ size, ...spacing }: TProps) => {
  const { cn, zise, margin, bg, primary, vividDark, isBlackPrimary, isDarkBlack } = useTwBelt()

  return {
    wrapper: cn(
      'circle opacity-80',
      zise(size),
      margin(spacing),
      isBlackPrimary ? bg('link') : primary('bg'),
      !isDarkBlack && vividDark(),
    ),
  }
}
