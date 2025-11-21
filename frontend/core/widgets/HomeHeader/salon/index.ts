import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  extend?: boolean
  isSticky?: boolean
}

export default ({ extend = false, isSticky = false }: TProps = {}) => {
  const {
    cn,
    br,
    linkable,
    fg,
    bg,
    fill,
    hoverLink,
    hoverLinkIcon,
    VDivider,
    menu,
    rainbow,
    zIndex,
  } = useTwBelt()

  return {
    wrapper: cn(
      'row-center-between w-full px-28 h-16 sticky top-0',
      'backdrop-blur-sm trans-all-200',
      isSticky && 'border-b rounded-bl-2xl rounded-br-2xl',
      extend ? bg('pageBg') : bg('cardAlpha'),
      zIndex('header'),
      br('divider'),
    ),
    brand: cn(linkable()),
    links: cn('row-center gap-x-6 ml-16 mt-px'),
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
