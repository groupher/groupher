import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary, vividDark } = useTwBelt()

  return {
    wrapper: 'row-center relative mb-6 opacity-80',
    wrapperActive: 'opacity-100',
    wrapperReadonly: 'mb-3 opacity-100',
    intro: 'w-full mt-1',
    header: 'row-center',
    name: cn('text-sm bold-sm', fg('title')),
    login: cn('text-xs ml-2 mt-px', fg('hint')),
    bio: cn('mt-0.5 text-sm opacity-90 w-3/5 line-clamp-1', fg('digest')),
    rootSign: cn(
      'text-xs bold-sm px-1.5 ml-2 rounded-md -mt-px border',
      fg('button.fg'),
      primary('bg'),
      vividDark(),
    ),
    pendingSign: cn(
      'text-xs bold-sm px-1.5 ml-2 rounded-md -mt-px border bg-transparent',
      primary('fg'),
      primary('borderSoft'),
    ),
    arrowIcon: cn('size-3.5 rotate-180 ml-0.5', primary('fill')),
    readonlyPermission: cn('text-sm', primary('fg')),
  }
}
