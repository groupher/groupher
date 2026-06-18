import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    button: cn('group align-both size-7 rounded-lg button-reset', fg('digest'), hover('box')),
    icon: cn('size-4.5', fill('digest'), hover('icon')),
  }
}
