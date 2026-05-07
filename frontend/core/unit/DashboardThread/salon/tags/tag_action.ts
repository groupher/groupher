// import { Wrapper as BarWrapper } from './tag_bar'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: 'row-center gap-x-1',
    iconBox: cn('size-5', hover('bg')),
    sortIconBox: cn('size-4 opacity-0 group-hover:opacity-100 trans-all-200', hover('bg')),
    icon: cn('size-3.5', hover('icon')),
  }
}
