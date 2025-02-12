import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('relative opacity-100 z-10'),
    notLoaded: '-z-10 opacity-0 absolute',
  }
}
