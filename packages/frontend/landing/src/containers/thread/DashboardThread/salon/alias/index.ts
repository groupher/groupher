import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'column w-6/12 ml-32',
    banner: cn('relative h-20 w-full mb-8 border-b', br('divider')),
    tabs: 'absolute bottom-0 -left-3.5',
  }
}
