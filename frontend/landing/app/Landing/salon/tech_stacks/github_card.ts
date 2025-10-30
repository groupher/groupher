import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'
import type { TColorName } from '~/spec'
import useBase from '..'

export default () => {
  const { cn, fill, bg, shadow, rainbow } = useTwBelt()
  const { wallpaper } = useWallpaper()
  const base = useBase()

  return {
    wrapper: cn(
      'column w-[340px] h-96 rounded-xl p-5 px-8 z-30 rotate-1 border',
      bg('card'),
      shadow('sm'),
      rainbow(wallpaper as TColorName, 'border'),
    ),
    topping: 'row-center mb-1.5',
    githubIcon: cn('size-14 absolute top-3 right-6 opacity-15', fill('text.digest')),
    githubTitle: cn('text-lg clip-text mt-1.5'),
    gradientTextStyle: base.textGradientStyle,
  }
}
