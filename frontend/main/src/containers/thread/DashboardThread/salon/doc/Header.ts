import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center w-full pb-2.5 mb-2.5'),
    title: cn('text-sm', fg('text.title')),
  }
}
