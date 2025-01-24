import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, divider } = useTwBelt()

  return {
    wrapper: cn('w-96 ml-40'),
    desc: 'w-4/5 leading-relaxed',
    divider: cn(divider(), 'mt-6 mb-8'),
  }
}
