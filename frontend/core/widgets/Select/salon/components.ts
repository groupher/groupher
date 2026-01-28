import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    optionRow: 'row items-end',
    optionTitle: cn('text-sm px-1.5 rounded', fg('digest')),
    optionTitleActive: fg('title'),
    optionDesc: cn('text-xs ml-4', fg('hint')),
  }
}
