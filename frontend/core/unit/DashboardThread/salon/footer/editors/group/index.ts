import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, primary } = useTwBelt()

  return {
    wrapper: 'column align-start justify-between',
    actionRow: 'row-center w-60 mb-8 -ml-px',
    linkGroup: 'row wrap justify-start w-full gap-8',
    column: 'w-[30%] h-full',
    items: 'column gap-x-6 gap-y-3 mb-6 min-h-24 rounded-md',
    itemsOver: cn(bg('hoverBg')),
    itemsTarget: cn('border border-dashed', primary('border')),
    adder: 'w-28',
    plusIcon: cn('size-3 mr-1.5', primary('fill')),
  }
}
