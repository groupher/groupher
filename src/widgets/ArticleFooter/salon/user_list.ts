import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, avatar } = useTwBelt()

  return {
    wrapper: cn('row-center wrap gap-2.5'),
    tabs: 'absolute -top-9 -left-3.5',
    avatar: cn('size-5', avatar()),
  }
}
