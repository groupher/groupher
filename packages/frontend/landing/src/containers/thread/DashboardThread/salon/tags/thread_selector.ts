import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row mb-8 mt-px'),
    hint: cn('text-sm mt-0.5 w-20 opacity-80', fg('text.digest')),
    cardsWrapper: cn('row-center w-full wrap ml-4 gap-3.5'),
  }
}
