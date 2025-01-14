import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-center h-4 w-5',
    icon: cn('size-4', fill('text.digest')),
    iconActive: cn('size-4', fill('text.title')),
  }
}
