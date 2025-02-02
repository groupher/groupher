import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    cards: cn('w-[calc(100%+30px)] -ml-4'),
  }
}
