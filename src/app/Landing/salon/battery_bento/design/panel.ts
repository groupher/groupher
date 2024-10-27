import useWallpaper from '~/hooks/useWallpaper'
import { COLOR_NAME } from '~/const/colors'

import { getCursorGradient, getPathGradient } from '../../metric'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, rainbow, shadow } = useTwBelt()
  const { wallpaper } = useWallpaper()

  const baseLine = cn('absolute border-dashed trans-all-200 z-10 opacity-30', br('text.digest'))
  const design = 'absolute top-11 left-14 bold-lg tracking-wide z-30'

  return {
    designText: cn(design, fg('text.digest'), 'italic trans-all-100'),
    designTextStyle: { fontSize: '42px' },

    designTextGradient: cn(design, 'clip-text trans-all-200'),
    designTextGradientStyle: {
      background: `linear-gradient(to left, ${getPathGradient(wallpaper)})`,
      fontSize: '42px',
    },

    wrapper: cn('relative p-4 pt-7 w-full h-full overflow-hidden'),
    gridBg: 'absolute left-10 top-5 w-44 h-28 opacity-10 z-10',
    gridBgStyle: {
      backgroundImage: `url("data:image/svg+xml,<svg id='patternId' width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><defs><pattern id='a' patternUnits='userSpaceOnUse' width='20' height='20' patternTransform='scale(1) rotate(0)'><rect x='0' y='0' width='100%' height='100%' fill='hsla(0,0%,100%,1)'/><path d='M 10,-2.55e-7 V 20 Z M -1.1677362e-8,10 H 20 Z'  stroke-width='0.5' stroke='hsla(259, 0%, 28%, 1)' fill='none'/></pattern></defs><rect width='800%' height='800%' transform='translate(-16,-4)' fill='url(%23a)'/></svg>")`,
    },
    mainCard: cn(
      'align-both absolute top-6 -right-5 rounded-xl border z-20',
      'w-72	h-36 rotate-3 trans-all-200',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    line: cn('left-0 w-full h-2.5 rotate-3 border-t', baseLine),
    column: cn('top-0 left-2 w-2.5 h-full border-r', baseLine),
    locateDot: cn(
      'absolute size-2 rounded border trans-all-200 opacity-50',
      bg('htmlBg'),
      br('text.digest'),
    ),
    // cursor
    cursor: 'absolute trans-all-200',
    cursorIcon: 'size-4 opacity-80 ml-3',
    cursorIconStyle: { fill: getCursorGradient(wallpaper) },
    cursorText: cn('text-xs bold rounded scale-90 px-1', fg('button.fg')),
    cursorTextStyle: { background: getCursorGradient(wallpaper) },

    //
    indexBar: cn('absolute w-px opacity-50', rainbow(COLOR_NAME.RED, 'bg')),
    indexBarBottom: cn(
      'absolute bottom-7 left-14 w-32 h-px opacity-50',
      rainbow(COLOR_NAME.RED, 'bg'),
    ),
    indexText: cn('absolute text-xs scale-90 px-2', rainbow(COLOR_NAME.RED, 'fg'), bg('htmlBg')),
  }
}
