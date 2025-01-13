import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, avatar, fg, bg, fill, menu } = useTwBelt()

  return {
    panel: cn('w-40 px-2 py-2'),
    avatar: cn('size-4', avatar('sm')),
    baseInfo: 'ml-3 mb-4',
    userName: cn('text-sm bold-sm', fg('text.title')),
    loginBy: cn('text-xs opacity-80', fg('text.digest')),
    menuBar: cn(menu('bar'), 'group h-8 w-full px-2.5 py-0.5 gap-y-2'),
    warningActive: cn(`hover:${fg('rainbow.red')}`, `hover:${bg('rainbow.redSoft')}`),
    menuTitle: cn('grow'),
    icon: cn('size-3.5 group-smoky', fill('text.digest')),
    logoutIcon: cn('size-3 group-smoky', `group-hover:${fill('rainbow.red')}`),
  }
}
