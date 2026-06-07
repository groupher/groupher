import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, br, primary } = useTwBelt()

  return {
    wrapper: 'column gap-8 mt-2.5 relative',
    gradientGrid: 'row-center wrap gap-2',
    card: cn(
      'size-10 circle p-0.5 relative border-2 border-transparent pointer trans-all-200',
      `hover:${br('digest')}`,
    ),
    cardActive: primary('border'),
    preview: 's-full circle overflow-hidden',
  }
}
