import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: cn('row justify-between w-11/12'),
    left: 'column w-full',
    linkBlock: 'w-60 pr-2',
    links: 'row wrap gap-6',
    right: 'w-48 list-disc mr-4',
    noteTitle: cn('text-xs mb-4 -ml-3.5 bold-sm', fg('text.digest')),
    noteP: cn('text-xs mb-3 leading-relaxed', fg('text.digest')),

    icon: cn('size-3', primary('fill')),
  }
}
