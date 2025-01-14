import useTwBelt from '~/hooks/useTwBelt'

import { getSlipMargin } from '../metric/tabs'

type TProps = {
  noAnimation: boolean
  slipHeight: 'px' | 1
}

export default ({ noAnimation, slipHeight }: TProps) => {
  const { cn, bg, primary, vividDark, isDarkBlack } = useTwBelt()

  return {
    wrapper: cn('relative text-sm w-auto overflow-hidden'),
    nav: cn('row-center relative flex-nowrap p-o my-auto'),
    slipbar: cn(
      'row justify-center absolute bottom-0 left-0 opacity-65',
      noAnimation && 'trans-all-200',
      'border-t border-t-transparent',
      `h-${slipHeight}`,
    ),
    realBar: cn(primary('bg'), isDarkBlack && bg('text.digest'), vividDark()),
    getSlipMargin,
  }
}
