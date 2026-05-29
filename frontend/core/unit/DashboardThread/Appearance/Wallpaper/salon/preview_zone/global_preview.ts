import useTwBelt from '~/hooks/useTwBelt'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import useBase from '../../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, br, bg, shadow } = useTwBelt()

  const { hasShadow } = useWallpaperDomain()
  const base = useBase()

  return {
    previewImage: cn(
      'w-72 h-44 trans-all-200',
      'column-align-both rounded-md border',
      br('divider'),
      bg('hoverBg'),
    ),
    realPreview: 'column-center relative overflow-hidden',
    content: cn(
      'absolute top-4 left-8 w-56 h-44 backdrop-blur-sm column-start px-5 pt-3 pb-4 rounded-t-md',
      hasShadow && shadow('md'),
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
