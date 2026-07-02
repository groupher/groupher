import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column relative border-t border-b',
      'pt-6 pb-3 mt-16 mb-8 min-h-24',
      'border-t border-b-2',
      br('divider'),
      fg('digest'),
    ),
    tabs: 'absolute left-0 top-0 -translate-y-full',
    content: 'row justify-between',
  }
}
