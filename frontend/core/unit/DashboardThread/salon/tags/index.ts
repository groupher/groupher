import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    icon: cn('size-3 mr-1', primary('fill')),
    dropIndicator: cn(
      'pointer-events-none fixed top-0 left-0 z-10 h-0 border-t border-dashed opacity-0',
      primary('border'),
    ),
    toolbar: 'row-center mb-8',
  }
}
