import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import useBase from '../../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, br, bg, shadow, primary } = useTwBelt()

  const { isDarkTheme } = useTheme()
  const wallpaper = useWallpaperDomain()
  const { hasShadow } = pickWallpaperThemeState(wallpaper, isDarkTheme)
  const base = useBase()

  return {
    previewImage: cn(
      'h-44 w-full trans-all-200',
      'column-align-both rounded-t-md border',
      br('divider'),
      bg('hoverBg'),
    ),
    realPreview: 'relative h-44 w-full overflow-hidden',
    bar: cn(base.bar, 'static h-2 w-24 saturate-50 opacity-40'),
    authCard: cn(
      'absolute top-10 left-1/2 -translate-x-1/2 w-24 h-24 rounded-lg column-center px-6 py-3 gap-2',
      bg('card'),
      hasShadow && shadow('md'),
    ),
    authTitle: 'w-10 h-1.5 mb-2 opacity-30',
    authInput: cn('w-full h-2.5 rounded opacity-15', primary('bg')),
    authButton: cn('w-full mt-1 h-3 rounded opacity-80', base.bar),
  }
}
