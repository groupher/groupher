import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    button: cn(
      'group row-center gap-1 h-7 px-2 rounded-lg button-reset text-xs bold-sm whitespace-nowrap',
      fg('digest'),
      hover('box'),
    ),
    icon: cn('size-4.5 mr-0.5', fill('digest'), hover('icon')),
    text: cn(fg('digest'), hover('fg')),
  }
}
