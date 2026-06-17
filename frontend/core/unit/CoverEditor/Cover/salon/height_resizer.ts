import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, primary } = useTwBelt()

  return {
    wrapper:
      'absolute inset-x-0 -bottom-3 z-50 h-6 cursor-ns-resize touch-none select-none opacity-0 transition-opacity duration-150',
    wrapperVisible: 'opacity-100',
    line: cn('absolute inset-x-0 top-3 h-px', primary('bg')),
    grip: cn(
      'align-both absolute left-1/2 top-3 flex h-3 w-6 -translate-x-1/2 -translate-y-1/2 gap-0.5 rounded-full border',
      primary('border'),
      bg('card'),
    ),
    dot: cn('size-0.5 rounded-full', primary('bg')),
  }
}
