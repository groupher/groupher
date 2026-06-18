import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    item: 'column items-start min-w-0 text-left',
    value: cn('text-sm min-h-5 break-words', fg('title')),
    label: cn('text-xs mt-1 break-words', fg('digest')),
  }
}
