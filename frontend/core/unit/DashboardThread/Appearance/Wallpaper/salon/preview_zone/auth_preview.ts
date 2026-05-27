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
    bar: cn(base.bar, 'static h-2 w-24 saturate-50 opacity-40'),
    authCard: cn(
      'absolute top-10 left-1/2 -translate-x-1/2 w-32 h-24 rounded-lg column-center px-3 py-3 gap-3',
      bg('card'),
      hasShadow && shadow('md'),
    ),
    authTitle: 'w-20 h-1.5 opacity-30',
    authInput: cn('w-full h-4 rounded border opacity-60', br('divider'), bg('hoverBg')),
    authButton: cn('w-full h-4 rounded opacity-50', base.bar),
  }
}
