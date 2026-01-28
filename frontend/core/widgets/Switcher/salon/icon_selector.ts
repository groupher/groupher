import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: cn('row-center relative'),
    tabs: cn(
      'row relative p-0.5 rounded-md z-20 border border-transparent trans-all-200',
      bg('hoverBg'),
    ),
    descText: cn('align-both min-w-24 px-2.5 py-1', fg('title')),
    label: cn('align-both size-6 text-sm pointer'),
    //
    slider: cn('row absolute size-6 rounded trans-all-200', bg('text.digest')),
  }
}
