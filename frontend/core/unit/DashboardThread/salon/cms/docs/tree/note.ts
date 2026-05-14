import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg } = useTwBelt()

  return {
    wrapper: cn('column w-96 h-auto p-5 rounded-lg', bg('hoverBg')),
    title: cn('text-sm bold mb-5', fg('title')),
    ul: 'ml-1',
    li: cn('text-sm mb-2.5 list-inside list-disc', fg('title')),
  }
}
