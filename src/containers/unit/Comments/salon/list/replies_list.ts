import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('ml-4'),
    countHint: cn('row-center text-xs ml-4 mt-2.5', fg('text.digest')),
    countNum: cn('bold-sm mr-1', fg('text.digest')),
    slashSign: 'text-xs bold opacity-65 mr-2',
    list: 'ml-4 pl-1',
  }
}
