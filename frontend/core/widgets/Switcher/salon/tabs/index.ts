import useTwBelt from '~/hooks/useTwBelt'

import { getSlipMargin } from '../metric/tabs'

type TProps = {
  noAnimation: boolean
  slipHeight: 'px' | 0.5
}

export default function useSalon({ noAnimation, slipHeight }: TProps) {
  const { cn, primary, vividDark } = useTwBelt()

  return {
    wrapper: 'relative text-sm w-auto overflow-hidden',
    nav: 'row-center relative flex-nowrap p-0 my-auto',
    slipBar: cn(
      'row justify-center absolute bottom-0 left-0 opacity-65',
      noAnimation && 'trans-all-200',
      'border-t border-t-transparent',
      `h-${slipHeight}`,
    ),
    realBar: cn(primary('bg'), vividDark()),
    getSlipMargin,
  }
}
