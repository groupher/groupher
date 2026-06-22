import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, sexyBorder, primary } = useTwBelt()

  return {
    wrapper: 'w-full',
    topWrapper: 'row w-full justify-between mb-5 p-1',
    divider: cn('mb-10', sexyBorder()),
    groupInputer: 'w-60',
    leftPart: 'column w-64 gap-y-6',
    rightPart: 'w-64 max-w-64 mr-4 list-disc',
    noteTitle: cn('text-xs mb-4 -ml-3.5 bold-sm', fg('digest')),
    noteP: cn('text-xs mb-3 leading-relaxed', fg('digest')),
    adder: 'row-center w-44 -ml-1.5',
    slash: cn('text-xs mx-1', fg('hint')),
    plusIcon: cn('size-2.5 mr-1', primary('fill')),
    //
    linkGroup: 'grid mt-7 w-full grid-cols-3 gap-x-5 gap-y-6',
    columnWrapper: 'h-full w-full min-w-0',
    itemsWrapper: 'column gap-y-1 mt-1 mb-5 min-h-32 rounded-md',
    itemsWrapperOver: bg('hoverBg'),
    itemsWrapperTarget: cn('border border-dashed', primary('border')),
    addLinkRow: 'row justify-start w-full',
  }
}
