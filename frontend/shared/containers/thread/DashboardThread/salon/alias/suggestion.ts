import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center mt-2.5'),
    list: 'row-center ml-3 gap-2.5 gap-x-2 -mt-0.5',
    hint: cn('text-xs ml-1', fg('text.digest')),
    item: cn('h-5'),
  }
}
