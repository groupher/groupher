import useTwBelt from '~/hooks/useTwBelt'
import { cnMerge } from '~/css'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill, menu } = useTwBelt()

  return {
    trigger: 'row-center plain-button',
    menu: cn('column w-32 p-1', menu('bg')),
    item: cn(menu('bar'), 'group h-8 min-w-0 justify-start text-left'),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
    iconBox: 'align-both size-6 shrink-0',
    itemIcon: cnMerge(menu('icon'), 'shrink-0 size-3.5'),
    itemTitle: cn(menu('title'), 'min-w-0 flex-1'),
  }
}
