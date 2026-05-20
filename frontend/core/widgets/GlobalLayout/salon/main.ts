import useTopbar from '~/hooks/useTopbar'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

export default function useSalon() {
  const { cn, bg, rainbow, container, vividDark, page } = useTwBelt()

  const { topbarBg } = useTopbar()
  const { hasShadow } = useWallpaper()

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
    scrollWrapper: 'absolute w-full',
    body: 'column-align-both relative z-10 w-full',
    footer: 'relative z-10 w-full',
  }
}
