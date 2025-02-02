import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, fill, shadow } = useTwBelt()

  return {
    wrapper: cn('absolute right-0 bottom-0 p-1 w-40 h-20', bg('htmlBg'), shadow('sm')),
    cardsWrapper: 'row-center ml-7 mt-5 gap-x-1',
    cardsIcon: cn('size-10 opacity-30', fill('text.digest')),
    dot: cn('absolute size-1.5 top-2 circle opacity-15', bg('text.digest')),
  }
}
