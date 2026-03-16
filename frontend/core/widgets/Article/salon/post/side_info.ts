import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, avatar, sexyBorder } = useTwBelt()

  return {
    wrapper: 'min-h-80 w-60 min-w-60 pt-4 mt-16',
    inner: 'w-full h-auto pl-16',
    divider: sexyBorder(),
    label: cn('row text-sm mb-3', fg('title')),
    value: cn('text-sm mb-1.5', fg('digest')),
    count: cn('text-xs ml-0.5', fg('digest')),
    userList: 'row wrap gap-2.5',
    user: 'row-center',
    avatar: cn('size-5', avatar()),
    nickname: cn('text-sm ml-2', fg('digest')),
    tags: 'mb-1.5 w-full',
  }
}
