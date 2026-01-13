import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('w-full pl-1'),
    publishFooter: cn('w-full row-between', 'border-t-2', br('divider'), 'mt-7 pt-5 pl-5 pr-9'),
  }
}
