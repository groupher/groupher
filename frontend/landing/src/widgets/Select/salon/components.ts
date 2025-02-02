import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    optionRow: 'row items-end',
    optionTitle: cn('text-sm px-1.5 rounded', fg('transparent')),
    optionTitleActive: fg('text.title'),
    optionDesc: cn('text-xs ml-4', fg('text.hint')),
  }
}
