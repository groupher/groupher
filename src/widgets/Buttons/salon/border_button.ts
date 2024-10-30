import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

export { cn } from '~/css'

import { getGithubGradient } from '../../../../src/app/Landing/salon/metric'

export default () => {
  const { cn, global, bg, shadow, fill, rainbow } = useTwBelt()
  const { wallpaper } = useWallpaper()

  return {
    wrapper: cn('relative group'),
    button: cn(shadow('xl')),
    background: cn('relative align-center p-1 rounded-xl overflow-hidden'),
    realBg: cn(
      'absolute -top-12 -left-2 size-40 circle',
      'animate-spin animate-infinite animate-duration-[30000ms]',
      global('gradient-purple'),
    ),

    darkButton: cn(
      'column w-auto h-auto rounded-xl p-0.5 border-2',
      bg('card', 'dark'),
      rainbow(wallpaper as TColorName, 'border'),
    ),
    backgroundStyle: { background: getGithubGradient(wallpaper) },

    arrow: cn(
      'absolute right-3 top-3 size-4 rotate-180 opacity-65 hidden group-hover:block trans-all-100',
      'z-20',
      fill('button.fg'),
    ),
  }
}
