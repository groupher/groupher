import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, linker } = useTwBelt()

  const wrapperBase = 'inline-flex shrink-0 animate-duration-500 animate-ease-in-out animate-twice'
  const iconBase = cn('size-3 opacity-50', linker('fill'))

  return {
    rightArrow: cn(wrapperBase, 'ml-0.5 group-hover-arrow-right'),
    rightArrowIcon: cn(iconBase, 'size-3 ml-0.5 rotate-180'),
    leftArrow: cn(wrapperBase, 'pr-1 group-hover-arrow-left'),
    leftArrowIcon: cn(iconBase, 'size-3'),
    upArrow: cn(wrapperBase, 'pr-1 group-hover-arrow-up'),
    upArrowIcon: cn(iconBase, 'size-2 rotate-90'),
    downArrow: cn(wrapperBase, 'pr-1 mt-px group-hover-arrow-down'),
    downArrowIcon: cn(iconBase, 'size-2 -rotate-90'),
    wrapper: '',
  }
}
