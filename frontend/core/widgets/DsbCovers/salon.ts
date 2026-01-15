import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, hoverBr, bg, fill, primary, isBlackPrimary } = useTwBelt()

  return {
    wrapper: 'column w-3/5',
    content: cn('grid w-full gap-4', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-8 -ml-0.5'),

    block: cn(
      'h-36 w-full rounded-md px-4 py-4 pointer',
      'column',
      'trans-all-100',
      hoverBr(),
      bg('alphaBg'),
    ),

    title: cn('text-base', fg('text.title')),
    desc: cn('text-xs', fg('text.digest')),
    icon: cn('size-5 ml-1 mt-1 opacity-80', primary('fill'), isBlackPrimary && fill('text.link')),
  }
}
