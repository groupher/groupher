import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, avatar } = useTwBelt()

  return {
    wrapper: cn('row-center-between mt-4'),
    account: 'row-center',
    avatar: cn('size-5', avatar()),
    username: cn('text-sm ml-3', fg('text.digest')),
    actions: 'row-center',
    pubIcon: cn('size-3 mr-1.5', fill('button.fg')),
  }
}
