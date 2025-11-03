import useTwBelt from '~/hooks/useTwBelt'
import useWallpaper from '~/hooks/useWallpaper'
// import { getGlowOpacity, getGlowBackground, getPathGradient } from './metric'
import { getCursorGradient, getPathGradient } from './metric'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, container, linkable, menu, landingTitle, sexyBorder } = useTwBelt()
  const { wallpaper } = useWallpaper()

  return {
    wrapper: cn('column-align-both relative h-full w-full overflow-hidden', container()),
    inner: 'column-align-both relative w-full h-full',
    banner: 'column-center relative w-full',
    githubInfo: cn('row-center mb-3 hover:underline pointer', fg('text.digest')),
    githubIcon: cn('size-4 mr-1.5'),
    githubText: 'clip-text bold text-base',
    githubIconStyle: { fill: getCursorGradient(wallpaper) },
    textGradientStyle: { background: `linear-gradient(to top, ${getPathGradient(wallpaper)})` },
    title: cn(landingTitle(), 'text-4xl opacity-70'),
    desc: cn('text-lg mt-4', fg('text.digest')),
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
