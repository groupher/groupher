import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

export default function useSalon() {
  const { bg, cn, container, containerWrapper, page } = useTwBelt()
  const { isDarkTheme } = useTheme()
  const wallpaper = useWallpaperDomain()
  const { contentShadow } = pickWallpaperThemeState(wallpaper, isDarkTheme)

  return {
    wrapper: cn(
      containerWrapper(),
      'column relative isolate s-full min-h-fit',
      'transition-transform transition-shadow backdrop-blur-2xl',
      contentShadow.enabled && 'shadow-lg',
      bg('pageBg'),
      page(),
    ),
    body: 'relative z-10 w-full',
    inner: cn('column-align-both w-full', container()),
    footer: 'relative z-10 w-full',
  }
}
