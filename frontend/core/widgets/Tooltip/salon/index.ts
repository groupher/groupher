import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, shadow } = useTwBelt()

  return {
    tooltip: cn(
      'relative p-1.5 rounded border backdrop-blur-sm cursor-default',
      shadow('xl'),
      fg('text.digest'),
      br('divider'),
    ),
  }
}
