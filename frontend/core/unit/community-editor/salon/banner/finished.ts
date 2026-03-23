import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, fill, menu, shadow, cut, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column-align-both relative w-full mt-10 mb-10',
    title: cn('text-xl mb-3.5 mt-5 -ml-2.5', fg('title')),
    desc: cn('text-sm mb-3', fg('digest')),
    frame: 'row w-[680px] h-[540px] rounded-xl mt-8',
    //
    leftFrame: cn('column-align-both w-1/2 h-full rounded-l-xl pb-5', bg('sandBox')),
    rightFrame: cn('column-align-both w-1/2 h-full rounded-r-xl px-2.5', bg('hoverBg')),
    //
    dashItem: cn(menu('bar'), 'py-4 px-6 h-20 rounded-lg'),
    dashTitle: cn(menu('title'), 'row-center text-base bold-sm'),
    dashDesc: cn('text-sm mt-1', fg('hint')),
    linkIcon: cn(menu('link'), 'size-4 ml-1'),
    //
    gotoLink: cn(
      'align-both text-sm w-max pl-4 pr-3 h-8 no-underline mt-8 border border-transparent rounded-lg',
      'hover:underline',
      br('divider'),
      fg('title'),
      bg('card'),
      shadow('sm'),
    ),
    goDashboard: 'mt-5',
    gotoLinkIcon: cn('size-3.5 ml-0.5 opacity-80', fill('digest')),
    //
    communityTitle: cn('text-lg mt-4 bold-sm', fg('title')),
    communityDesc: cn('text-sm', fg('hint'), cut('w-48')),
    //
    divider: cn(sexyBorder(), 'my-5'),
  }
}
