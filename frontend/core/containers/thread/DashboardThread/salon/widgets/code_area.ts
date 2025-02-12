import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: cn('column relative min-h-20 w-full p-4 pr-20', bg('sandBox'), fg('text.digest')),
    copyBtn: 'absolute right-2.5 top-3',
  }
}
