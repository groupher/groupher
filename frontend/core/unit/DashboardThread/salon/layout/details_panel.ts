import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'mt-10',
    header: 'row-center mb-4',
    title: cn('text-base font-medium', fg('title')),
    content: cn('border py-8 px-4 rounded-md', bg('cardAlpha'), br('divider')),
    divider: cn(sexyBorder(), 'mt-8'),
    savingWrapper: cn('mt-8 border-t pt-8', br('divider')),
  }
}
