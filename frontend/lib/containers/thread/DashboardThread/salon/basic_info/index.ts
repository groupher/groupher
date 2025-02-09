import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('column pl-48'),

    banner: cn('w-full h-20 mb-10 relative border-b', br('divider')),
    tabs: cn('absolute -left-2 bottom-0'),
  }
}
