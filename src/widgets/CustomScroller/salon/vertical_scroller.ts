import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    viewHolder: cn('w-full h-px'),
  }
}
