import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'
import { getCursorGradient, getPathGradient } from '../../metric'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, fill, rainbow, shadow } = useTwBelt()
  const { wallpaper } = useWallpaper()

  const baseLine = cn('absolute border-dashed trans-all-200 z-10 opacity-30', br('digest'))
  const design = 'absolute top-11 left-14 bold-lg tracking-wide z-30'

  return {
    designText: cn(design, fg('digest'), 'italic trans-all-100'),
    designTextStyle: { fontSize: '42px' },

    designTextGradient: cn(design, 'clip-text trans-all-200'),
    designTextGradientStyle: {
      background: `linear-gradient(to left, ${getPathGradient(wallpaper)})`,
      fontSize: '42px',
    },

    wrapper: 'relative p-4 pt-7 s-full overflow-hidden',
    gridIcon: cn('absolute top-3 size-28', fill('digest')),
    mainCard: cn(
      'align-both absolute top-6 -right-5 rounded-xl border z-20',
      'w-72	h-36 rotate-3 trans-all-200',
      bg('card'),
      br('divider'),
      shadow('sm'),
    ),
    line: cn('left-0 w-full h-2.5 rotate-3 border-t', baseLine),
    column: cn('top-0 left-2 w-2.5 h-full border-r', baseLine),
    locateDot: cn(
      'absolute size-2 rounded border trans-all-200 opacity-50',
      bg('card'),
      br('digest'),
    ),
    // cursor
    cursor: 'absolute trans-all-200',
    cursorIcon: 'size-4 opacity-80 ml-3',
    cursorIconStyle: { fill: getCursorGradient(wallpaper) },
    cursorText: cn('text-xs bold rounded scale-90 px-1', fg('button.fg')),
    cursorTextStyle: { background: getCursorGradient(wallpaper) },

    //
    indexBar: cn('absolute w-px opacity-50', rainbow(COLOR.RED, 'bg')),
    indexBarBottom: cn('absolute bottom-7 left-14 w-32 h-px opacity-50', rainbow(COLOR.RED, 'bg')),
    indexText: cn('absolute text-xs scale-90 px-2', rainbow(COLOR.RED, 'fg'), bg('card')),
  }
}
