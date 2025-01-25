import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('row-center -ml-2.5'),
    input: cn('w-36 h-7', bg('alphaBg')),
  }
}
