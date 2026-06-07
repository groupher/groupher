import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg } = useTwBelt()

  return {
    wrapper: 'row-center w-full gap-4 mb-4',
    title: cn('text-sm shrink-0', fg('title')),
    line: cn('border-t flex-1', br('divider')),
  }
}
