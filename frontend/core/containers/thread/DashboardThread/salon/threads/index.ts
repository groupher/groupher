import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, divider } = useTwBelt()

  return {
    wrapper: 'w-96',
    divider: cn(divider(), 'mt-6 mb-8'),
  }
}
