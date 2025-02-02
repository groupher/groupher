import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('px-20 py-4 min-h-96'),
    comments: 'min-h-96 mt-8',
  }
}
