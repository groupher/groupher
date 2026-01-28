import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, sexyBorder, primary } = useTwBelt()

  return {
    wrapper: 'w-full',
    topWrapper: cn('row w-full justify-between mb-5 p-1'),
    divider: cn('mb-10', sexyBorder()),
    groupInputer: 'w-60',
    leftPart: 'column w-64 gap-y-6',
    rightPart: 'w-64 max-w-64 mr-4 list-disc',
    noteTitle: cn('text-xs mb-4 -ml-3.5 bold-sm', fg('digest')),
    noteP: cn('text-xs mb-3 leading-relaxed', fg('digest')),
    adder: 'row-center w-44 -ml-1 scale-95',
    slash: cn('text-xs ml-3 mr-3', fg('hint')),
    plusIcon: cn('size-3 mr-1.5', primary('fill')),
    //
    linkGroup: 'row wrap justify-start mt-7 w-full gap-x-5 gap-y-7',
    columnWrapper: 'w-[30%] h-full',
    itemsWrapper: 'column gap-y-5 mb-5',
  }
}
