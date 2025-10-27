import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'
import useBase from '..'
import { getCursorGradient } from '../metric'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, dimDark } = useTwBelt()
  const { wallpaper } = useWallpaper()
  const base = useBase()

  return {
    wrapper: cn(
      'column relative h-full w-[520px] rounded-xl rounded-r-none',
      'mr-16',
      isLightTheme && bg('cardAlpha'),
    ),
    banner: 'w-auto mb-5 -mt-2',
    title: cn('text-xl bold-sm mt-4', fg('text.title')),
    techs: cn('row wrap w-full -ml-1 mt-2 h-72 items-start gap-x-10 z-20', dimDark()),
    topping: cn('row-center -mt-1 mb-1.5 -ml-2 px-2.5 w-28', bg('card')),
    //
    hammerIcon: 'size-3.5 mr-1.5',
    hammerIconStyle: { fill: getCursorGradient(wallpaper) },
    //
    stackText: 'text-sm bold clip-text',
    gradientTextStyle: base.textGradientStyle,
  }
}
