import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    bgRow: 'row-center wrap gap-2',
    imageItem: cn(
      'align-both size-8 border border-transparent rounded-md opacity-90 trans-all-100',
      bg('card'),
      `hover:${br('digest')}`,
    ),
    imageItemActive: cn('opacity-100', br('digest')),
    imageBlock: cn('block size-6 rounded', bg('hoverBg')),
  }
}
