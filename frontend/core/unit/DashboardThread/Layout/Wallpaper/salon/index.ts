import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'

import useBase from '../../useLayoutBaseSalon'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fill, br, bg, shadow } = useTwBelt()

  const { hasShadow } = useWallpaper()
  const base = useBase()

  return {
    wrapper: 'column',
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
    content: cn(
      'absolute top-0 left-7 w-60 h-44 backdrop-blur-sm column-start px-5 pt-3 pb-4',
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
