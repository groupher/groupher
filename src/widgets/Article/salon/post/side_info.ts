import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, avatar, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('min-h-80 w-60 min-w-60 pt-4 mt-16'),
    inner: 'w-full h-auto pl-16',
    divider: sexyHBorder(),
    label: cn('text-sm mb-3', fg('text.title')),
    value: cn('text-sm mb-1.5', fg('text.digest')),
    count: cn('text-xs ml-0.5', fg('text.digest')),
    userList: 'column wrap gap-y-2.5',
    user: 'row-center',
    avatar: cn('size-5', avatar()),
    nickname: cn('text-sm ml-2', fg('text.digest')),
    tags: 'mb-1.5 w-full',
  }
}
