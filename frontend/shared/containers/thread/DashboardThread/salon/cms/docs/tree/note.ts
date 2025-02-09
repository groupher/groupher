import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, fg } = useTwBelt()

  return {
    wrapper: cn('column w-96 h-auto p-5 rounded-lg', bg('hoverBg')),
    title: cn('text-sm bold mb-5', fg('text.title')),
    ul: 'ml-1',
    li: cn('text-sm mb-2.5 list-inside list-disc', fg('text.title')),
  }
}
