import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column items-center w-full h-[480px]',
    scroll: 'relative w-full h-[480px] overflow-y-scroll',
    title: cn('text-sm', fg('title')),
  }
}
