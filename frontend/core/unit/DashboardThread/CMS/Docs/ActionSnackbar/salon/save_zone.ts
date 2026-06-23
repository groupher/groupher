import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, accent, hover, primary, rainbow } = useTwBelt()

  return {
    savedButton: cn(
      'group row-center gap-1 h-7 w-18 px-1 rounded-lg button-reset text-xs bold-sm whitespace-nowrap',
      fg('digest'),
      hover('box'),
    ),
    iconSlot: 'align-both size-4 shrink-0',
    savedIcon: cn('size-3.5', fill('rainbow.green')),
    dirtyDot: cn('size-1.5 rounded-full', accent('bg')),
    errorDot: cn('size-1.5 rounded-full', rainbow(COLOR.RED, 'bg')),
    syncIcon: cn('size-3.5 animate-spin', fg('digest')),
    textViewport: cn('w-11 overflow-hidden text-left', fg('digest'), hover('fg')),
    textTrackItem: 'block',
    publishGroup: 'row-center ml-1',
    publishButton: cn(
      'h-7 px-3 rounded-l-lg rounded-r-none button-reset text-xs bold-sm pr-1.5 disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    publishMenuButton: cn(
      'align-both h-7 w-5 rounded-r-lg rounded-l-none button-reset pr-2 disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    publishIcon: 'size-3.5 -rotate-90 fill-current',
    publishMenu: cn('column min-w-72 p-1 rounded-lg', fg('digest')),
    publishMenuItem: cn(
      'grid grid-cols-[18px_minmax(0,1fr)] gap-2 w-full rounded-md px-2 py-2 text-left button-reset',
      hover('box'),
    ),
    publishMenuCheck: cn('size-3.5 mt-0.5', fill('rainbow.green')),
    publishMenuTitle: cn('block text-xs bold-sm', fg('title')),
    publishMenuDesc: cn('block text-xs leading-5 mt-0.5', fg('digest')),
  }
}
