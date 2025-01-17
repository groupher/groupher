import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column w-full'),
    titleInput: 'mb-2.5',
    bodyInput: 'mb-4',
  }
}
