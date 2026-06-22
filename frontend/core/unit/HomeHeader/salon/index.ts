import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  extend?: boolean
  isSticky?: boolean
}

export default function useSalon({ extend = false, isSticky = false }: TProps = {}) {
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
    header: cn(
      'sticky top-0 backdrop-blur-sm trans-all-200',
      isSticky && 'border-b rounded-bl-2xl rounded-br-2xl',
      extend ? bg('pageBg') : bg('cardAlpha'),
      zIndex('header'),
      br('divider'),
    ),
    inner: 'row-between w-full px-28 h-16',
    brand: linkable(),
    links: 'row-center gap-x-4 ml-16 mt-px',
    linkItem: hoverLink(),
    linkItemActive: fg('title'),
    stackLink: cn(hoverLink(), 'pl-3 hover:no-underline'),
    linkActive: cn(fg('title'), bg('hoverBg')),
    //
    requestDemoLink: hoverLink('text-sm'),
    demoIcon: cn(hoverLinkIcon(), 'mt-px'),
    arrowIcon: cn(hoverLinkIcon(), '-rotate-90 mt-px mr-0 ml-1'),
    //
    extraInfo: 'row-center min-w-40 justify-end',
    divider: cn(VDivider(), 'ml-3'),
    //
    panel: cn('w-32 mt-1', menu('bg')),
    menuBar: cn(menu('bar'), 'group pl-3'),
    menuIconBox: 'align-both w-8 h-8 min-w-8 mr-4 mt-0.5 rounded-md group-smoky-80',
    purpleBg: rainbow(COLOR.PURPLE, 'bgSoft'),
    blueBg: rainbow(COLOR.BLUE, 'bgSoft'),
    redBg: rainbow(COLOR.RED, 'bgSoft'),
    cyanBg: rainbow(COLOR.CYAN, 'bgSoft'),

    purpleIcon: rainbow(COLOR.PURPLE, 'fill'),
    blueIcon: rainbow(COLOR.BLUE, 'fill'),
    redIcon: rainbow(COLOR.RED, 'fill'),
    cyanIcon: rainbow(COLOR.CYAN, 'fill'),

    menuIcon: cn('size-5', fill('digest')),
    menuBarColumn: 'column !items-start py-2',
    menuTitle: menu('title'),
    menuDesc: cn('text-xs mt-1 pr-1 opacity-80', fg('digest')),
  }
}
