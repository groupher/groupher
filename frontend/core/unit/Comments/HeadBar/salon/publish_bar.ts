import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, avatar } = useTwBelt()

  return {
    wrapper: 'row-between mt-4',
    account: 'row-center',
    avatar: cn('size-5', avatar()),
    username: cn('text-sm ml-3', fg('digest')),
    actions: 'row-center',
    pubIcon: cn('size-3 mr-1.5', fill('button.fg')),
  }
}
