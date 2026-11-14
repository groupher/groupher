import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { hasPreviewWallpaper } from '~/shell/GlobalLayout/background'
import useDsbShell from '~/stores/dsbShell/hooks'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import useBase from '../../../../useDsbSalon'

export default function useSalon() {
  const { cn, br, bg, shadow } = useTwBelt()

  const { isDarkTheme } = useTheme()
  const wallpaper = useWallpaperDomain()
  const wallpaperState = pickWallpaperThemeState(wallpaper, isDarkTheme)
  const contentShadow = useDsbShell().contentShadow
  const hasWallpaper = hasPreviewWallpaper(wallpaperState)
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
      'absolute bottom-0 left-8 right-8 h-40 column-start px-5 pt-3 pb-4 rounded-t-md',
      hasWallpaper && 'backdrop-blur-sm',
      hasWallpaper && contentShadow && shadow('md'),
    ),
    contentTop: 'column gap-3',
    contentBottom: 'column gap-3 mt-auto',

    barBase: cn(base.barBase, 'static'),
    bar: cn(base.barBase, 'static h-2 w-24 saturate-50 opacity-40'),
    titleBar: 'h-2 w-24 saturate-50 opacity-30',
    wideBar: 'h-2 w-40 saturate-50 opacity-20',
    midBar: 'h-2 w-32 saturate-50 opacity-30',
    longBar: 'h-2 w-44 saturate-50 opacity-20',
    shortBar: 'h-2 w-20 saturate-50 opacity-20',
    dimBar: 'h-2 w-32 saturate-50 opacity-10',
    footerShort: 'h-2 w-14 saturate-50 opacity-15',
    footerWide: 'h-2 w-32 saturate-50 opacity-10',
  }
}
