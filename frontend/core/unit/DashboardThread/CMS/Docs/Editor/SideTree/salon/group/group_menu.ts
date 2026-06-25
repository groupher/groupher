import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ active }: { active: boolean }) {
  const { cn, bg, fill, hover, menu } = useTwBelt()

  return {
    trigger: cn('align-both size-5 plain-button', hover('box'), active && bg('hoverBg')),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
    menu: cn('column w-36 p-1', menu('bg')),
    item: cn(menu('bar'), 'group h-8 min-w-0 justify-start text-left'),
    itemDanger: cn(menu('dangerBar'), 'group h-8 min-w-0 justify-start text-left'),
    iconBox: 'align-both size-6 shrink-0',
    itemTitle: cn(menu('title'), 'min-w-0 flex-1'),
    itemDangerTitle: cn(menu('dangerTitle'), 'min-w-0 flex-1'),
    itemIcon: cn(menu('icon'), 'shrink-0 size-3.5'),
    itemDangerIcon: cn(menu('dangerIcon'), 'shrink-0 size-3.5'),
  }
}
