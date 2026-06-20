import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill, hover, menu } = useTwBelt()

  return {
    menu: cn('column w-36 p-1', menu('bg')),
    item: cn(menu('bar'), 'h-8 justify-start text-left'),
    iconBox: 'align-both size-6 shrink-0',
    icon: cn(menu('icon'), 'size-3.5 shrink-0'),
    title: menu('title'),
    trigger: cn('row-center size-6 rounded plain-button', hover('bg')),
    triggerIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
