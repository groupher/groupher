import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import useBase from '../../../../useDsbSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, br, bg, shadow } = useTwBelt()

  const { isDarkTheme } = useTheme()
  const wallpaper = useWallpaperDomain()
  const { contentShadow } = pickWallpaperThemeState(wallpaper, isDarkTheme)
  const base = useBase()

  return {
    previewImage: cn(
      'h-44 w-full trans-all-200',
      'column-align-both rounded-t-md border',
      br('divider'),
      bg('hoverBg'),
    ),
    realPreview: 'relative h-44 w-full overflow-hidden',
    content: cn(
      'absolute bottom-0 left-8 right-8 h-40 backdrop-blur-sm column-start px-5 pt-3 pb-4 rounded-t-md',
      contentShadow.enabled && shadow('md'),
    ),
    contentTop: 'column gap-3',
    contentBottom: 'column gap-3 mt-auto',

    bar: cn(base.bar, 'static h-2 w-24 saturate-50 opacity-40'),
    titleBar: 'opacity-30',
    wideBar: 'w-40 opacity-20',
    midBar: 'w-32 opacity-30',
    longBar: 'w-44 opacity-20',
    shortBar: 'w-20 opacity-20',
    dimBar: 'w-32 opacity-10',
    footerShort: 'w-14 opacity-15',
    footerWide: 'w-32 opacity-10',
  }
}
