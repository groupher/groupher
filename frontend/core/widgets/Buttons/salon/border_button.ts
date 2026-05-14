import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

export { cn } from '~/css'

// TODO: move to @groupher-share
const getGithubGradient = (wallpaper: string): string => {
  switch (wallpaper) {
    case GRADIENT_WALLPAPER_NAME.PINK: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #211227e0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.GREEN: {
      return 'linear-gradient(64deg, #2b2b29 60%, #0e230fe0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.ORANGE: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #271512e0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.BLUE:
    case GRADIENT_WALLPAPER_NAME.PURPLE: {
      return 'linear-gradient(64deg, #2f2f2f 20%, #0c1d2ee0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.GREY: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #272524e0 100%)'
    }

    default: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #271512e0 100%)'
    }
  }
}

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, shadow, fill, br } = useTwBelt()
  const { wallpaper } = useWallpaper()

  return {
    wrapper: 'relative group',
    button: cn(
      isLightTheme ? shadow('xl') : shadow('lg'),
      !isLightTheme && cn('border-2', br('digest')),
    ),
    background: cn(
      'relative align-center rounded-xl overflow-hidden shadow-inner',
      isLightTheme ? 'p-1' : 'p-0.5',
    ),
    realBg: cn(
      'absolute -top-12 -left-2 size-40 circle',
      'animate-spin animate-infinite animate-duration-[30000ms]',
      'gradient-purple',
      !isLightTheme && 'opacity-80',
    ),

    backgroundStyle: { background: getGithubGradient(wallpaper) },

    arrow: cn(
      'absolute right-3 top-3 size-4.5 rotate-180 hidden group-hover:block trans-all-100',
      'z-20',
      isLightTheme && 'opacity-65',
      isLightTheme ? fill('button.fg') : fill('digest'),
    ),
  }
}
