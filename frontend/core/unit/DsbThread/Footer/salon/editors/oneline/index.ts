import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg, primary } = useTwBelt()

  return {
    wrapper: 'row justify-between',
    left: 'column w-full',
    linkBlock: 'w-60 pr-2',
    links: 'row wrap gap-6 min-h-16 rounded-md',
    linksOver: bg('hoverBg'),
    right: 'w-48 list-disc mr-4',
    noteTitle: cn('text-xs mb-4 -ml-3.5 bold-sm', fg('digest')),
    noteP: cn('text-xs mb-3 leading-relaxed', fg('digest')),

    icon: cn('size-3', primary('fill')),
  }
}
