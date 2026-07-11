import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

import type { TTabsVariant } from '../../Tabs/spec'

type TProps = {
  noAnimation: boolean
  slipHeight: 'px' | 0.5
  slipBarPos: 'top' | 'bottom'
  variant: TTabsVariant
} & TSpace

export default function useSalon({
  noAnimation,
  slipHeight,
  slipBarPos,
  variant,
  ...spacing
}: TProps) {
  const { cn, margin, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn(
      'relative w-auto overflow-hidden text-sm',
      variant === 'docs' && 'h-12',
      margin(spacing),
    ),
    nav: cn('row-center relative flex-nowrap p-0 my-auto', variant === 'docs' && 'h-full gap-x-10'),
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
  }
}
