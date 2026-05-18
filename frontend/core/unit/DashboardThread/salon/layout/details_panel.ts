import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg } = useTwBelt()

  return {
    details: 'mt-10',
    detailsHeader: 'row-center mb-4',
    detailsTitle: cn('text-base font-medium', fg('title')),
    detailDivider: cn('border-t pt-8', br('divider')),
    savingWrapper: cn('mt-8 border-t pt-8', br('divider')),
  }
}
