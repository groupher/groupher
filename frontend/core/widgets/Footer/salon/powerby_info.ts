import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full mt-12',
    note: cn('text-xs', fg('digest')),
    link: cn(
      'text-xs ml-0.5 mr-0.5 no-underline hover:underline transition-colors',
      `hover:${fg('title')}`,
      fg('digest'),
    ),
    bottom: 'row-center mt-1.5',
    lineDivider: cn('h-2.5 w-px ml-2 mr-1.5', bg('divider')),
  }
}
