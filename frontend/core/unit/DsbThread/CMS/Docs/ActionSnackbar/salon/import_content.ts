import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    button: cn(
      'group align-both size-7 rounded-lg button-reset disabled:cursor-wait disabled:opacity-60',
      fg('digest'),
      hover('box'),
    ),
    icon: (pending: boolean) =>
      cn('size-4.5', pending && 'animate-pulse', fill('digest'), hover('icon')),
  }
}
