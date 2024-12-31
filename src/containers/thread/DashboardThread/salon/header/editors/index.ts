import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, sexyHBorder, primary } = useTwBelt()

  return {
    topWrapper: cn('row w-11/12 justify-between mb-5 p-1'),
    divider: cn('mb-10', sexyHBorder()),
    groupInputer: 'w-60',
    leftPart: 'column w-64 gap-y-6',
    rightPart: 'w-64 max-w-64 mr-4 list-disc',
    noteTitle: cn('text-xs mb-4 -ml-3.5 bold-sm', fg('text.digest')),
    noteP: cn('text-xs mb-3 leading-relaxed', fg('text.digest')),
    adder: 'row-center w-44 -ml-1 scale-95',
    slash: cn('text-xs ml-3 mr-3', fg('text.hint')),
    plusIcon: cn('size-3 mr-1.5', primary('fill')),
    //
    linkGroup: 'row wrap justify-start mt-7 w-full gap-x-5 gap-y-7',
    columnWrapper: 'w-[30%] h-full',
    itemsWrapper: 'column gap-y-5 mb-5',
  }
}
