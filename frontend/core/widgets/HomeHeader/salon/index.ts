import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const {
    cn,
    linkable,
    fg,
    bg,
    br,
    fill,
    hoverLink,
    hoverLinkIcon,
    VDivider,
    menu,
    rainbow,
    shadow,
  } = useTwBelt()

  return {
    stickyWrapper: cn(
      'row-center-between fixed top-0 left-1/2 transform -translate-x-1/2 z-50',
      'w-3/5 rounded-2xl rounded-tl-none rounded-tr-none h-12 pl-8 pr-2 backdrop-blur-2xl border',
      br('divider'),
      shadow('card'),
      bg('cardAlpha'),
    ),
    normal: cn('row-center-between w-full px-28 h-16'),
    brand: cn(linkable()),
    links: cn('row-center gap-x-6 ml-12 mt-px'),
    linkItem: hoverLink(),
    linkItemActive: fg('text.title'),
    stackLink: cn(hoverLink(), 'pl-3 hover:no-underline'),
    linkActive: cn(fg('text.title'), bg('hoverBg')),
    //
    requestDemoLink: cn(hoverLink('text-sm')),
    demoIcon: cn(hoverLinkIcon(), 'mt-px'),
    arrowIcon: cn(hoverLinkIcon(), '-rotate-90 mt-px mr-0 ml-1'),
    //
    extraInfo: 'row-center min-w-40 justify-end',
    divider: cn(VDivider(), 'ml-3'),
    //
    panel: cn('w-32 mt-1', menu('bg')),
    menuBar: cn(menu('bar'), 'group pl-3'),
    menuIconBox: cn('align-both w-8 h-8 min-w-8 mr-4 mt-0.5 rounded-md group-smoky-80'),
    purpleBg: rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
    blueBg: rainbow(COLOR_NAME.BLUE, 'bgSoft'),
    redBg: rainbow(COLOR_NAME.RED, 'bgSoft'),
    cyanBg: rainbow(COLOR_NAME.CYAN, 'bgSoft'),

    purpleIcon: rainbow(COLOR_NAME.PURPLE, 'fill'),
    blueIcon: rainbow(COLOR_NAME.BLUE, 'fill'),
    redIcon: rainbow(COLOR_NAME.RED, 'fill'),
    cyanIcon: rainbow(COLOR_NAME.CYAN, 'fill'),

    menuIcon: cn('size-5', fill('text.digest')),
    menuBarColumn: cn('column !items-start py-2'),
    menuTitle: cn(menu('title')),
    menuDesc: cn('text-xs mt-1 pr-1 opacity-80', fg('text.digest')),
  }
}
