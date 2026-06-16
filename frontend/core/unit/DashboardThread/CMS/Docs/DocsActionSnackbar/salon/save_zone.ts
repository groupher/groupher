import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover, primary } = useTwBelt()

  return {
    savedButton: cn(
      'group row-center gap-1 h-7 px-2.5 rounded-lg button-reset text-xs bold-sm whitespace-nowrap',
      fg('digest'),
      hover('box'),
    ),
    savedIcon: cn('size-3.5', fill('rainbow.green')),
    text: cn(fg('digest'), hover('fg')),
    publishGroup: 'row-center ml-1',
    publishButton: cn(
      'h-7 px-3 rounded-l-lg rounded-r-none button-reset text-xs bold-sm pr-1.5',
      primary('bg'),
      fg('button.fg'),
    ),
    publishMenuButton: cn(
      'align-both h-7 w-5 rounded-r-lg rounded-l-none button-reset pr-2',
      primary('bg'),
      fg('button.fg'),
    ),
    publishIcon: 'size-3.5 -rotate-90 fill-current',
  }
}
