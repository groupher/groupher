import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill, menu } = useTwBelt()

  return {
    trigger: 'row-center plain-button',
    menu: cn('column w-32 p-1', menu('bg')),
    item: cn(menu('bar'), 'h-8 justify-start text-left'),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
    iconBox: 'align-both size-6 shrink-0',
    itemIcon: cn(menu('icon'), 'shrink-0'),
    itemTitle: menu('title'),
  }
}
