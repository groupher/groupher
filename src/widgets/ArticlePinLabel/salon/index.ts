import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, primary } = useTwBelt()

  return {
    pinIcon: cn('size-4 absolute top-0 left-0 opacity-80', primary('fill')),
  }
}
