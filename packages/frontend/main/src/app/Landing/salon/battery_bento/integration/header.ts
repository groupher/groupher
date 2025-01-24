import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('row-center w-full h-5 z-20 absolute top-1.5'),
    dot: cn('size-1.5 circle absolute top-1 opacity-20', bg('text.digest')),
    bar: cn('absolute top-1 w-20 h-1 rounded-md opacity-20', bg('text.digest')),
  }
}
