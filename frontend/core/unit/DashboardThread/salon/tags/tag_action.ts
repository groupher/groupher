// import { Wrapper as BarWrapper } from './tag_bar'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: 'row-center gap-x-1',
    iconBox: cn('align-both size-5 rounded-md border-0 bg-transparent p-0', hover('bg')),
    editIconBox: cn(
      'align-both size-5 rounded-md border-0 bg-transparent p-0 group-smoky-0 focus-visible:opacity-100',
      hover('bg'),
    ),
    icon: cn('size-3.5', hover('icon')),
  }
}
