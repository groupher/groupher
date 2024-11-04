import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, bg, fill } = useTwBelt()

  const base = cn('align-both size-5 circle border', br('text.digest'))
  return {
    dot: cn('size-2 circle', bg('text.digest')),
    //
    done: cn(base, 'size-4', bg('text.digest'), 'border-none'),
    doing: cn(base, 'border-dashed animate-spin animate-duration-[8000ms]'),
    todo: cn(base, 'border', br('divider')),
    //
    checkIcon: cn('size-2.5', fill('button.fg')),
  }
}
