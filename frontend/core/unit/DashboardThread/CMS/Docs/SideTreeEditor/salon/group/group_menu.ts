import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fill, menu } = useTwBelt()

  return {
    trigger: 'row-center bg-transparent border-0 p-0',
    moreIcon: cn('size-3.5 pointer', fill('digest')),
    menu: cn('column w-36 p-1', menu('bg')),
    item: cn(menu('bar'), 'h-8 justify-start text-left'),
    iconBox: cn('align-both size-6'),
    itemTitle: menu('title'),
    itemIcon: cn(menu('icon'), 'shrink-0 size-4'),
  }
}
