import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    icon: 'size-4',
    wrapper: cn(
      'button-reset align-both size-8 rounded-sm transition-colors active:scale-96',
      fg('digest'),
      hover('box'),
    ),
  }
}
