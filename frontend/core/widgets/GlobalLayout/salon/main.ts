import useTopbar from '~/hooks/useTopbar'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

export default function useSalon() {
  const { cn, bg, rainbow, container, vividDark, page } = useTwBelt()

  const { topbarBg } = useTopbar()
  const { hasShadow } = useWallpaperDomain()

  return {
    wrapper: cn(
      container(),
      'column relative isolate s-full min-h-fit',
      // NOTICE: this class will cause children's position fixed fail,
      'transition-transform transition-shadow backdrop-blur-2xl',
      hasShadow && 'shadow-lg',
      bg('pageBg'),
      page(),
    ),
    topBar: cn('h-0.5 w-full absolute top-0 left-0 z-20', rainbow(topbarBg, 'bg'), vividDark()),
    // Dedicated repaint target for high-frequency theme background preview.
    // Do not move --preview-page-bg back onto wrapper/<main>; it regresses
    // slider performance because the wrapper owns the full page and blur styles.
    background: 'pointer-events-none absolute inset-0 z-0',
    scrollWrapper: 'absolute w-full',
    body: 'column-align-both relative z-10 w-full',
    footer: 'relative z-10 w-full',
  }
}
