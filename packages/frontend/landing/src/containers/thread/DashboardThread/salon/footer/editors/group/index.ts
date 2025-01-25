import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, primary } = useTwBelt()

  return {
    wrapper: cn('column align-start justify-between w-11/12'),
    actionRow: 'row-center w-60 mb-8 -ml-px',
    linkGroup: 'row wrap justify-start w-full gap-8',
    column: 'w-[30%] h-full',
    items: 'column gap-x-6 gap-y-3 mb-6',
    adder: 'w-28',
    plusIcon: cn('size-3 mr-1.5', primary('fill')),
  }
}
