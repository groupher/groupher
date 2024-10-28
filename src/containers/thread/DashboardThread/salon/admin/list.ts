import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, primary, vividDark } = useTwBelt()

  return {
    wrapper: 'column pr-1',
    user: 'row relative mb-6 opacity-80',
    userActive: 'opacity-100',
    intro: 'w-full',
    header: 'row-center',
    name: cn('text-sm bold-sm', fg('text.title')),
    login: cn('text-xs ml-2 mt-px', fg('text.hint')),
    bio: cn('mt-0.5 text-sm opacity-90 w-3/5 line-clamp-3', fg('text.digest')),
    //
    rootSign: cn(
      'text-xs bold-sm px-1.5 ml-2 rounded-md -mt-px border',
      fg('button.fg'),
      primary('bg'),
      vividDark(),
    ),
    settingIcon: cn(),
    arrowIcon: cn('size-3.5 rotate-180 ml-0.5', primary('fill')),
  }
}
