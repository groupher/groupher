import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

import { getSlipMargin } from '../metric/tabs'

type TProps = {
  noAnimation: boolean
  slipHeight: 'px' | 0.5
  slipBarPos: 'top' | 'bottom'
} & TSpace

export default function useSalon({ noAnimation, slipHeight, slipBarPos, ...spacing }: TProps) {
  const { cn, margin, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn('relative text-sm w-auto overflow-hidden', margin(spacing)),
    nav: 'row-center relative flex-nowrap p-0 my-auto',
    slipBar: cn(
      'row justify-center absolute left-0 opacity-65',
      slipBarPos === 'top' ? 'top-0' : 'bottom-0',
      !noAnimation && 'trans-all-200',
      slipBarPos === 'top' ? 'border-b border-b-transparent' : 'border-t border-t-transparent',
      `h-${slipHeight}`,
    ),
    realBar: cn(
      'block h-full rounded-full',
      !noAnimation && 'trans-all-200',
      primary('bg'),
      vividDark(),
    ),
    getSlipMargin,
  }
}
