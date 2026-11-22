import useTheme from '~/hooks/useTheme'
import useTopbar from '~/hooks/useTopbar'
import useTwBelt from '~/hooks/useTwBelt'
import type { TContainerMetric } from '~/hooks/useTwBelt/spec'
import { hasPublishedWallpaper } from '~/shell/GlobalLayout/background'
import useDsb from '~/stores/dsb/hooks'
import useStaticWallpaper from '~/stores/staticWallpaper/hooks'

type TProps = {
  containerMetric: TContainerMetric | null
}

export default function useSalon({ containerMetric }: TProps) {
  const { cn, rainbow, container, containerWrapper, vividDark, page } = useTwBelt()

  const { topbarBg } = useTopbar()
  const { isDarkTheme } = useTheme()
  const publishedWallpaper = useStaticWallpaper()
  const dashboard = useDsb()
  const theme = isDarkTheme ? 'dark' : 'light'
  const hasWallpaper = hasPublishedWallpaper(publishedWallpaper, theme)
  const contentShadowEnabled = dashboard.contentShadow ?? false

  return {
    wrapper: cn(
      containerWrapper(),
      'column relative isolate s-full min-h-fit',
      'transition-transform transition-shadow',
      hasWallpaper && contentShadowEnabled && 'shadow-lg',
      page(),
    ),
    topBar: cn('h-0.5 w-full absolute top-0 left-0 z-20', rainbow(topbarBg, 'bg'), vividDark()),
    // Dedicated full-page surface for high-frequency theme background preview.
    // Keep --preview-page-bg here instead of wrapper/<main>; this is the only
    // layer that owns the Content surface color and backdrop blur.
    background: 'pointer-events-none abs-full z-0',
    hasWallpaper,
    scrollWrapper: 'absolute w-full',
    body: 'relative z-10 w-full',
    inner: cn(
      'column-align-both w-full',
      container(),
      containerMetric && container(containerMetric),
    ),
    footer: 'relative z-10 w-full',
  }
}
