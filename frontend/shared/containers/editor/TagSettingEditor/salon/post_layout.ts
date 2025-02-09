import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, fg, br, shadow } = useTwBelt()

  return {
    wrapper: cn('row-center wrap w-full gap-x-10 pt-2.5 pl-8 pb-7', bg('hoverBg')),
    layout: 'column-align-both w-40 h-24',
    block: cn('rounded-md bg-transparent px-4 py-4 border pointer', br('divider')),
    blockActive: cn(bg('hoverBg'), shadow('sm'), br('text.digest')),
    layoutTitle: fg('text.title'),
  }
}
