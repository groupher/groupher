import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: cn('row-center px-1.5 gap-x-4'),
    icon: cn('size-3.5', fill('text.digest'), `hover:${fill('text.title')}`),
  }
}
