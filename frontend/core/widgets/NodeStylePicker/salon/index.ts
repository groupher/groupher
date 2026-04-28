import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn, br, fg, hover, shadow } = useTwBelt()

  return {
    wrapper: 'w-fit',
    trigger: cn(
      'align-both size-9 rounded-md border transition-all duration-150',
      br('divider'),
      hover('box'),
    ),
    panel: cn('w-96 pt-1 pb-0.5', shadow('xl')),
    content: 'min-h-80 min-w-0',
    todo: cn('align-both h-80 text-lg', fg('digest')),
    previewIconColor: bg('digest'),
  }
}
