import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row',
    left: 'w-24 mr-24',
    right: 'row wrap w-80 gap-y-5',
    section: 'w-32 h-20',
    hint: cn('row-center text-xs', fg('text.hint')),
    num: cn('text-2xl bold-sm mt-1', fg('text.title')),
  }
}
