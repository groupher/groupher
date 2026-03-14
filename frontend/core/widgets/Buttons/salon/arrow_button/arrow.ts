import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, linker } = useTwBelt()

  const base = cn('size-3 trans-all-100', linker('fill'))

  return {
    rightArrow: cn(base, 'size-3 ml-0.5 group-hover:ml-1.5 rotate-180'),
    leftArrow: cn(base, 'size-4 pr-1 group-hover:-ml-1 group-hover:mr-1'),
    upArrow: cn(base, 'size-4 pr-1 mt-1 rotate-90 group-hover:mt-0.5'),
    downArrow: cn(base, 'size-4 pr-1 -mt-1 -rotate-90 group-hover:mt-0'),
    wrapper: '',
  }
}
