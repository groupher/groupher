import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, avatar } = useTwBelt()

  return {
    wrapper: 'row-center mt-5 ml-1.5',
    avatar: cn('size-4', avatar()),
    name: cn('text-xs ml-2', fg('text.digest')),
  }
}
