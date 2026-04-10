import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const base = useBase()
  const { cn, cnMerge, avatar, primary } = useTwBelt()

  return {
    wrapper: base.baseSection,
    select: 'row-center wrap gap-x-5 gap-y-8 w-full',
    inline: 'inline-block',
    layout: 'column-center justify-between h-32',
    block: cnMerge(base.blockBase, 'h-24 min-h-24 p-4'),
    masonryBlock: cnMerge(base.blockBase, 'h-24 min-h-24 px-3 py-0'),
    blockActive: base.blockBaseActive,

    frame: 'column h-full w-full',
    topRow: 'row-between',
    header: 'column gap-2',
    footer: 'row-between mt-auto',
    footerLeft: 'row-center gap-3',
    footerRight: 'row-center gap-2',
    contentRow: 'row gap-4 s-full',
    sideColumn: 'column-start gap-2',
    textColumn: 'column gap-2',
    masonryGrid: 'row gap-4 h-full items-start',
    masonryCol: 'column gap-2 grow basis-0 min-w-0 h-full',

    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    circle: cnMerge(base.circle, 'opacity-40'),
    commentIcon: cnMerge(base.icon, 'static'),
    upvoteIcon: cnMerge(base.icon, 'static size-4'),

    userAvatar: cnMerge(base.bar, 'static size-6', avatar()),
    upvoteBtn: cn(
      'column-align-both w-10 h-11 border rounded-lg text-xs',
      primary('borderSoft'),
      primary('fg'),
    ),

    metaBar: 'w-16 h-1 opacity-30',
    titleBar: 'w-28 h-2.5 opacity-50',
    bodyWide: 'w-48 mt-0.5 opacity-30',
    scoreBar: 'w-10 h-2 opacity-40',
    noteBar: 'w-10 h-1 opacity-20 mb-0.5',

    phTitleBar: 'w-24 h-2.5 opacity-40',
    phBodyWide: 'w-36 h-1.5 opacity-20',
    phBodyTiny: 'w-14 h-1.5 opacity-15',

    masonryTopBar: 'w-28 h-2 opacity-15',
    masonryMainCard: 'w-28 h-12 opacity-50',
    masonryBottomCard: 'w-28 h-6 opacity-20',
    masonrySideTop: 'w-28 h-4 opacity-20',
    masonrySideMain: 'w-28 h-14 opacity-40',
    masonrySideBottom: 'w-28 h-2 opacity-15',

    minimalTitleBar: 'w-28 h-2.5 opacity-40',
    minimalBodyWide: 'w-36 h-1.5 opacity-20',
    minimalBodyTiny: 'w-10 h-1.5 opacity-15',

    coverMedia: 'w-24 h-16 opacity-20',
    coverMeta: 'w-12 h-1.5 opacity-20',
    coverTitle: 'w-28 h-2 opacity-40',
    coverScore: 'w-4 h-1.5 opacity-30',
    coverNote: 'w-6 h-1.5 opacity-20',
  }
}
