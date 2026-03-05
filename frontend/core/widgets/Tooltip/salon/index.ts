import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default () => {
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    tooltip: cn(
      // 'relative p-1.5 rounded border backdrop-blur-sm cursor-default',
      'relative inline-block w-fit max-w-[360px] p-1.5 rounded border backdrop-blur-sm cursor-default',
      shadow('xl'),
      fg('digest'),
      bg('popover.bg'),
      br('divider'),
    ),
    content: 'break-words whitespace-normal',
  }
}
