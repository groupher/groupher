import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column justify-between relative h-auto'),
  }
}
