import type { TColorName } from '~/spec'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

export { cn } from '~/css'

import { getGithubGradient } from '../../../../src/app/Landing/salon/metric'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, global, bg, shadow, fill, rainbow } = useTwBelt()
  const { wallpaper } = useWallpaper()

  return {
    wrapper: cn('relative group'),
    button: cn(
      isLightTheme ? shadow('xl') : shadow('lg'),
      !isLightTheme && 'border-2 border-text-digset',
    ),
    background: cn(
      'relative align-center rounded-xl overflow-hidden shadow-inner',
      isLightTheme ? 'p-1' : 'p-0.5',
    ),
    realBg: cn(
      'absolute -top-12 -left-2 size-40 circle',
      'animate-spin animate-infinite animate-duration-[30000ms]',
      global('gradient-purple'),
      !isLightTheme && 'opacity-80',
    ),

    darkButton: cn(
      'column w-auto h-auto rounded-xl p-0.5 border-2',
      bg('card', 'dark'),
      rainbow(wallpaper as TColorName, 'border'),
    ),
    backgroundStyle: { background: getGithubGradient(wallpaper) },

    arrow: cn(
      'absolute right-3 top-3.5 size-4 rotate-180 hidden group-hover:block trans-all-100',
      'z-20',
      isLightTheme && 'opacity-65',
      isLightTheme ? fill('button.fg') : fill('text.digest'),
    ),
  }
}
