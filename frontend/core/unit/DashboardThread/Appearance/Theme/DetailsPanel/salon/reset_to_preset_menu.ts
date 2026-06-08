import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover, fg, menu } = useTwBelt()

  return {
    trigger: cn(
      'group row-center gap-1 px-1.5 py-0.5 rounded-md text-xs whitespace-nowrap pointer',
      hover('box'),
    ),
    triggerText: cn('text-xs', hover('fg')),
    triggerIcon: cn('size-3 -rotate-90', hover('icon')),
    menu: cn('w-48 p-1', menu('bg')),
    menuItem: cn(menu('bar'), 'w-full px-2.5 py-1.5 text-left'),
    menuTitle: cn(menu('title'), 'text-sm whitespace-nowrap'),
    based: cn('text-sm', fg('digest')),
  }
}
