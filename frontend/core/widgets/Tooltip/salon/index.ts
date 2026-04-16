import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    tooltip: cn(
      // 'relative p-1.5 rounded border backdrop-blur-sm cursor-default',
      'relative inline-block w-fit p-1.5 rounded border backdrop-blur-sm cursor-default debug',
      shadow('xl'),
      fg('digest'),
      bg('popover.bg'),
      br('divider'),
    ),
    content: 'break-words whitespace-normal',
  }
}
