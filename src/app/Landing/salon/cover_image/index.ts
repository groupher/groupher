import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-[1080px] z-20'),
    other: 'w-full relative -z-10',
  }
}
