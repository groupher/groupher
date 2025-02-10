import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  popWidth: number
}

export default ({ popWidth }: TProps) => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('px-1.5 py-1', `w-${popWidth}`),
  }
}
