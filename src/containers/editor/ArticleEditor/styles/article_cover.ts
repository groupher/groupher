import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, hoverable } = useTwBelt()

  return {
    wrapper: cn('mb-2'),
    adder: cn(hoverable('bg'), 'row-center w-fit px-2 py-1.5 ml-2 rounded-md'),
    imageIcon: cn('size-4 mr-1.5 -mt-px opacity-65', hoverable('icon')),
    addTitle: cn('text-sm', hoverable('fg')),
  }
}
