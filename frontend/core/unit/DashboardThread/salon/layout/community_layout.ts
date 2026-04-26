import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, cut, primary, sexyBorder, sexyVBorder } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    select: 'row-center wrap gap-8 w-full',
    layout: 'group button-reset column-align-both',
    block: cnMerge(base.blockBase, 'h-56 px-4 pt-4 pb-3'),
    blockActive: base.blockBaseActive,
    communityTitle: cn('text-xs bold-sm', cut('w-14'), primary('fg')),
    primaryBar: cn('opacity-65', primary('bg')),
    bar: cnMerge(base.bar, 'static'),
    circle: cnMerge(base.circle, 'static'),

    hDivider: sexyBorder(),
    vDivider: sexyVBorder(35),

    frame: 'column h-full w-full',
    nav: 'row-between items-center',
    navCenter: 'row-center gap-3 ml-5',
    mainClassic: 'row h-full gap-4 pt-4',
    mainCover: 'column h-full gap-2',
    mainSidebar: 'row h-full gap-4 pt-4',

    contentColumn: 'column gap-4 grow',
    sectionBlock: 'column gap-2',
    rightRail: 'column gap-2 w-12 shrink-0 pb-1',
    coverHero: cnMerge(base.bar, 'static h-12 w-full opacity-10 rounded-sm'),
    coverHeader: 'row h-12 items-end gap-4 -mt-8 ml-2',
    coverContent: 'row gap-4 grow pt-2',
    coverLead: 'row-end gap-3',
    coverAction: 'ml-auto mr-2',
    coverMain: 'column gap-3 grow',
    coverSection: 'column gap-1.5 ml-2',
    sidebarNav: 'column gap-2.5 w-14',
    sidebarMain: 'column gap-4 ml-5',

    homeTitle: 'w-10',
    navBar: 'w-20',
    primaryChip: 'w-10 h-2.5',
    contentTitleWide: 'w-36',
    contentTitle: 'w-28',
    contentDigestWide: 'w-32 h-1 opacity-20',
    contentDigest: 'w-26 h-1 opacity-20',
    contentDigestShort: 'w-24 h-1 opacity-20',
    railTitle: 'w-10 h-2.5',
    railItem: 'w-7 h-1 opacity-20',
    railItemWide: 'w-9 h-1 opacity-20',
    railItemShort: 'w-5 h-1 opacity-20',
    footerItem: 'w-8 h-1 opacity-30',
    sideNavItem: 'w-8 h-1 opacity-20',
    sideNavItemWide: 'w-10 h-1 opacity-20',
    sideNavActive: 'w-8 h-1 opacity-60',
    sidebarBottom: 'w-6 h-1 opacity-30',
    coverAvatar: 'w-10 h-10 opacity-30 rounded-sm',
    coverBodyLong: 'w-30 h-1 opacity-20',
    coverBodyShort: 'w-26 h-1 opacity-30',
    coverFooterLong: 'w-32 h-1 opacity-30',
  }
}
