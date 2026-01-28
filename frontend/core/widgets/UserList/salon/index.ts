import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column items-center w-full gap-y-5 px-12'),
    title: cn('text-xs', fg('title')),
  }
}
