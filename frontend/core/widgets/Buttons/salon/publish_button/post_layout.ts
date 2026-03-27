import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn(
      'row-center justify-between w-full',
      BANNER_LAYOUT.HEADER === bannerLayout ? 'min-w-40' : 'min-w-28',
    ),
    title: 'text-xs pl-0.5 bold-sm',
    editIcon: cn('size-3 mr-1 opacity-80', fill('button.fg')),
  }
}
