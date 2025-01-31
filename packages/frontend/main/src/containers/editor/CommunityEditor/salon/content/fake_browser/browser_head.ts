import { COLOR_NAME } from '~/const/colors'
import { keys, includes } from 'ramda'

import useWallpaper from '~/hooks/useWallpaper'
import { GRADIENT_WALLPAPER, GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useTwBelt from '~/hooks/useTwBelt'

// TODO: move this with landing to @groupher/ftontend-shared.
export const getPathGradient = (wallpaper: string): string => {
  if (!includes(wallpaper, keys(GRADIENT_WALLPAPER))) {
    return '#f2bc5a,#f76b6b'
  }

  if (wallpaper === GRADIENT_WALLPAPER_NAME.PINK) {
    return '#f8be6d,#c479de'
  }

  if (wallpaper === GRADIENT_WALLPAPER_NAME.GREY) {
    return '#E1D5CC,#955D29'
  }

  // @ts-ignore
  const { colors } = GRADIENT_WALLPAPER[wallpaper]

  if (!colors) return ''

  const color1 = colors[0]
  const color2 = colors[colors.length - 1]

  return `${color1}, ${color2}`
}

export { cn } from '~/css'

export default () => {
  const { wallpaper } = useWallpaper()
  const { cn, fg, br, bg, fill, rainbow } = useTwBelt()

  return {
    header: cn('row w-full h-9 pl-4 pr-4 pt-2 rounded-t-xl', bg('alphaBg')),
    tabContent: cn('grow text-xs z-10 pl-2 overflow-hidden max-w-48', fg('text.digest')),
    addrBar: cn('row-center w-full px-1 h-10 border-b', bg('hoverBg'), br('divider')),
    //
    tab: cn('row-center w-40 h-7 relative mx-1 rounded-t-md', bg('hoverBg')),
    tabLeft: cn(
      'absolute -left-3.5 top-px -skew-y-12 rotate-6 w-4 h-7 rounded-tl-xl z-10',
      bg('hoverBg'),
    ),
    tabRight: cn(
      'absolute -right-3.5 top-px skew-y-12 -rotate-6 w-4 h-7 rounded-tr-xl z-10',
      bg('hoverBg'),
    ),
    //
    toolbar: 'row-center gap-x-2.5 ml-3.5 mr-2.5',
    toolIcon: cn('size-3.5 opacity-80', fill('text.digest')),
    lockIcon: cn('size-3.5 mt-0.5 ml-1 opacity-50', fill('text.digest')),
    moreIcon: cn('size-3.5 mt-px opacity-80', fill('text.digest')),
    starIcon: cn('size-3.5 mt-0.5 opacity-65', rainbow(COLOR_NAME.ORANGE, 'fill')),
    form: cn('row-center grow h-7 rounded-xl ml-1 mr-0.5 pl-1.5', bg('card')),
    input: cn('row-center border-none w-full px-2.5', fg('text.title')),
    mainDomain: cn('text-sm', fg('text.title')),
    mainDomainActive: cn('text-sm opacity-90', fg('text.digest')),

    slash: cn('inline-block ml-0.5 mr-px text-xs', fg('text.hint')),
    threadPath: 'row-center',
    threadText: cn('', fg('text.title')),
    //
    domainText: cn('text-sm clip-text'),
    domainTextStyle: {
      background: `linear-gradient(to left, ${getPathGradient(wallpaper)})`,
    },
  }
}
