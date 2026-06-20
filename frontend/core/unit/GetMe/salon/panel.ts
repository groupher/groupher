import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, menu, sexyBorder } = useTwBelt()

  return {
    wrapper: 'w-52 px-2 py-2.5',
    menuBar: cn(menu('bar'), 'h-12 mt-1 mb-1 py-3'),
    info: 'column ml-1.5',
    title: cn('text-sm', fg('digest')),
    appStoreBar: 'row-center h-14 ml-3.5 smoky-90',
    platform: cn('text-xs', fg('hint')),
    iconBox: 'align-both size-7',
    storeIcon: 'w-40 h-auto',
    icon: 'size-6',
    linkIcon: menu('link'),
    divider: cn(sexyBorder(), 'mt-2 mb-1.5'),
  }
}
