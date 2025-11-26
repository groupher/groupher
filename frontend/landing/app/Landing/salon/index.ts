import { COLOR_NAME } from '~/const'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'
// import { getGlowOpacity, getGlowBackground, getPathGradient } from './metric'
import { getCursorGradient, getPathGradient } from './metric'

export { cn } from '~/css'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, fill, container, rainbow, linkable, menu, landingTitle, sexyBorder } =
    useTwBelt()
  const { wallpaper } = useWallpaper()

  const colorText = 'grayscale-50 bold-sm'
  const colorFill = ''

  return {
    wrapper: cn('column-align-both relative h-full w-full overflow-hidden', container()),
    inner: 'column-align-both relative w-full h-full',
    banner: 'column-center relative w-full pt-16',
    githubInfo: cn('row-center mt-12 mb-3 hover:underline pointer', fg('text.digest')),
    githubIcon: cn('size-4 mr-1.5'),
    githubText: 'clip-text bold text-base',
    githubIconStyle: { fill: getCursorGradient(wallpaper) },
    textGradientStyle: { background: `linear-gradient(to top, ${getPathGradient(wallpaper)})` },
    title: cn(landingTitle(), 'text-5xl opacity-70 mb-6 mt-4'),
    iconHead: 'opacity-80 row-center gap-x-4 relative mt-5 mb-4',
    iconFootBar: cn(
      'absolute bottom-2 w-60 h-4 -left-5 rounded-md',
      bg('text.digest'),
      isLightTheme ? 'opacity-10' : 'opacity-20',
    ),
    icon: cn('size-9 inline-block mr-1 -mt-1 z-20'),
    desc: cn('inline-flex items-center text-center text-lg', fg('text.digest')),
    //
    focus: cn('bold-sm mx-0.5', fg('text.title')),
    //
    purpleFill: cn(rainbow(COLOR_NAME.PURPLE, 'fill'), colorFill),
    blueFill: cn(rainbow(COLOR_NAME.BLUE, 'fill'), colorFill),
    redFill: cn(rainbow(COLOR_NAME.RED, 'fill'), colorFill),
    cyanFill: cn(rainbow(COLOR_NAME.CYAN, 'fill'), colorFill),

    purpleText: cn(rainbow(COLOR_NAME.PURPLE, 'fg'), colorText),
    blueText: cn(rainbow(COLOR_NAME.BLUE, 'fg'), colorText),
    redText: cn(rainbow(COLOR_NAME.RED, 'fg'), colorText),
    cyanText: cn(rainbow(COLOR_NAME.CYAN, 'fg'), colorText),
    //
    buttonGroup: 'row-center mt-6 -ml-5 gap-x-4 w-auto',
    linkable: linkable(),
    //
    demoPanel: cn('column gap-x-0.5 py-0.5 w-32', menu('bg')),
    demoItem: cn(menu('bar'), 'py-1'),
    demoItemTitle: cn(menu('title')),
    outLink: cn(menu('link')),
    arrow: cn('size-3.5 rotate-180 ml-0.5', fill('text.digest')),
    //
    divider: cn('mb-20 mt-14', sexyBorder()),
    faqWrapper: 'w-full mt-32 pl-52 pr-48',
    //
    tryArrow: cn(
      'absolute -right-5 top-0.5 size-4 rotate-180 opacity-65 hidden group-hover:block trans-all-100',
      fill('button.fg'),
    ),
  }
}
