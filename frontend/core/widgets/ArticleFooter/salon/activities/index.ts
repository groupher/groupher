import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, avatar } = useTwBelt()

  return {
    wrapper: cn('column relative w-full'),
    item: cn('row-center text-xs mb-3 ml-1 relative leading-5', fg('text.hint')),
    tail: cn('absolute -bottom-3 h-3 left-1 w-px ml-0.5', bg('divider')),
    avatar: cn('size-5 -ml-0.5 mr-1', avatar()),
    content: 'ml-2.5',
    highlight: cn('my-0.5', fg('text.title')),
    lastUpdate: cn(
      'absolute right-2 top-0 pointer trans-all-200 text-xs',
      fg('text.hint'),
      `hover:${fg('text.title')}`,
    ),
  }
}
