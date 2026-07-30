import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg } = useTwBelt()

  return {
    iconAction: cn(
      'align-both size-8 rounded-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed',
      fg('digest'),
      `hover:${fg('title')}`,
      `hover:${bg('hoverBg')}`,
    ),
    wrapper: 'row-center gap-1 shrink-0',
  }
}
