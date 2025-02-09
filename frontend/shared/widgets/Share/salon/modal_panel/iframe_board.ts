import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: 'h-full',
    header: 'row-center-between mb-3.5',
    title: cn('text-sm', fg('text.title')),
    codeWrapper: cn('text-xs -ml-1.5', fg('text.digest')),
    inputer: bg('divider'),
  }
}
