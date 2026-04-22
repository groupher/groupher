import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, br, bg, fill } = useTwBelt()

  const base = cn('align-both size-5 circle border', br('digest'))

  return {
    dot: cn('size-2 circle', bg('digest')),
    //
    done: cn(
      base,
      'size-4',
      !isDarkTheme && cn(bg('digest'), 'border-none'),
      isDarkTheme && cn(bg('card'), 'border-dotted'),
    ),
    doing: cn(base, 'border-dashed animate-spin animate-duration-[8000ms]'),
    todo: cn(base, 'border', br('divider')),
    //
    checkIcon: cn('size-2.5', fill('button.fg')),
  }
}
