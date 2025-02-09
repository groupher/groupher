import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, fill, br, bg, shadow } = useTwBelt()

  const { hasShadow } = useWallpaper()
  const base = useBase()

  return {
    wrapper: cn('column'),
    preview: 'row-center w-full wrap gap-8',
    hoverMask: 'group column-center relative',
    settingIcon: cn(
      'size-6 absolute top-20 left-36 -ml-2 z-10 pointer group-smoky-0 trans-all-200',
      fill('button.fg'),
    ),
    previewer: 'column-center',
    previewImage: cn(
      'w-72 h-44 trans-all-200',
      'column-align-both rounded-md border',
      br('divider'),
      bg('hoverBg'),
    ),
    realPreview: 'column-center relative overflow-hidden',
    content: cn('absolute top-0 left-7 w-60 h-44 backdrop-blur-sm', hasShadow && shadow('md')),

    bar: cn(base.bar, 'h-2 w-24 left-5 saturate-50 opacity-40'),
  }
}
