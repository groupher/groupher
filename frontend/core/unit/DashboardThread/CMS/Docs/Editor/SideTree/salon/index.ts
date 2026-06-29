export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, scrollbar } = useTwBelt()

  return {
    wrapper: 'sticky column min-h-0 pr-2 overflow-visible',
    groupList: cn(
      'column min-h-0 flex-1 gap-y-4 -ml-7 w-[calc(100%+2.625rem)] overflow-y-auto overscroll-contain pl-7 pr-6 pb-14',
      scrollbar('thin'),
    ),
    empty: 'px-1 pt-2 text-xs text-digest',
  }
}
