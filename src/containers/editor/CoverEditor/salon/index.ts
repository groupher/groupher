import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('group column-align-both mb-8 relative pb-7 ml-7'),
  }
}
