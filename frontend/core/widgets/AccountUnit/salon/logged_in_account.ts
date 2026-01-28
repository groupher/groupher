import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, avatar, fg, bg, fill, menu, sexyBorder, linkable } = useTwBelt()

  return {
    panel: cn('w-40 px-2 py-2'),
    avatar: cn('size-4', avatar('sm')),
    baseInfo: 'ml-3 mb-4',
    userName: cn('text-sm bold-sm', fg('title')),
    loginBy: cn('text-xs opacity-80', fg('digest')),
    menuBar: cn(menu('bar'), 'row justify-between group h-8 w-full px-2.5 py-0.5 gap-y-2'),
    warningActive: cn(`hover:${fg('rainbow.red')}`, `hover:${bg('rainbow.redSoft')}`),
    menuTitle: '',
    icon: cn('size-3.5 group-smoky-65', fill('digest')),
    logoutIcon: cn('size-3 group-smoky-65 ml-auto', `group-hover:${fill('rainbow.red')}`),
    //
    divider: cn(sexyBorder(), 'my-2'),
    linkable: linkable(),
  }
}
