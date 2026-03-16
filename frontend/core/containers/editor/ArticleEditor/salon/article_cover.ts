import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: 'mb-2',
    adder: cn(hover('bg'), 'row-center w-fit px-2 py-1.5 ml-2 rounded-md'),
    imageIcon: cn('size-4 mr-1.5 -mt-px opacity-65', hover('icon')),
    addTitle: cn('text-sm', hover('fg')),
  }
}
