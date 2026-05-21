import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useLayoutBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon({ compact = false }: { compact?: boolean } = {}) {
  const base = useBase()
  const { cn, cnMerge, avatar, primary } = useTwBelt()

  return {
    wrapper: base.baseSection,
    select: 'row-center wrap gap-x-5 gap-y-8 w-full',
    inline: 'inline-block',
    layout: 'column-center justify-between h-32',
    block: cnMerge(
      base.blockBase,
      compact ? 'w-full h-[72px] min-h-[72px] p-3' : 'h-24 min-h-24 p-4',
    ),
    masonryBlock: cnMerge(
      base.blockBase,
      compact ? 'w-full h-[72px] min-h-[72px] px-2.5 py-0' : 'h-24 min-h-24 px-3 py-0',
    ),
    blockActive: base.blockBaseActive,

    frame: 'column h-full w-full',
    topRow: 'row-between',
    header: cn('column', compact ? 'gap-1.5' : 'gap-2'),
    footer: 'row-between mt-auto',
    footerLeft: cn('row-center', compact ? 'gap-2' : 'gap-3'),
    footerRight: cn('row-center', compact ? 'gap-1.5' : 'gap-2'),
    contentRow: cn('row s-full', compact ? 'gap-2.5' : 'gap-4'),
    sideColumn: 'column-start gap-2',
    textColumn: cn('column', compact ? 'gap-1.5' : 'gap-2'),
    masonryGrid: cn('row h-full items-start', compact ? 'gap-2.5' : 'gap-4'),
    masonryCol: cn('column grow basis-0 min-w-0 h-full', compact ? 'gap-1.5' : 'gap-2'),

    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    circle: cnMerge(base.circle, 'opacity-40'),
    commentIcon: cnMerge(base.icon, 'static'),
    upvoteIcon: cnMerge(base.icon, compact ? 'static size-3' : 'static size-4'),

    userAvatar: cnMerge(base.bar, compact ? 'static size-5' : 'static size-6', avatar()),
    upvoteBtn: cn(
      compact
        ? 'column-align-both w-8 h-9 border rounded-lg text-[10px]'
        : 'column-align-both w-10 h-11 border rounded-lg text-xs',
      primary('borderSoft'),
      primary('fg'),
    ),

    metaBar: compact ? 'w-12 h-1 opacity-30' : 'w-16 h-1 opacity-30',
    titleBar: compact ? 'w-24 h-2 opacity-50' : 'w-28 h-2.5 opacity-50',
    bodyWide: compact ? 'w-32 mt-0.5 opacity-30' : 'w-48 mt-0.5 opacity-30',
    scoreBar: compact ? 'w-7 h-1.5 opacity-40' : 'w-10 h-2 opacity-40',
    noteBar: compact ? 'w-7 h-1 opacity-20 mb-0.5' : 'w-10 h-1 opacity-20 mb-0.5',

    phTitleBar: compact ? 'w-20 h-2 opacity-40' : 'w-24 h-2.5 opacity-40',
    phBodyWide: compact ? 'w-24 h-1.5 opacity-20' : 'w-36 h-1.5 opacity-20',
    phBodyTiny: compact ? 'w-10 h-1.5 opacity-15' : 'w-14 h-1.5 opacity-15',

    masonryTopBar: compact ? 'w-full h-1.5 opacity-15' : 'w-28 h-2 opacity-15',
    masonryMainCard: compact ? 'w-full h-8 opacity-50' : 'w-28 h-12 opacity-50',
    masonryBottomCard: compact ? 'w-full h-4 opacity-20' : 'w-28 h-6 opacity-20',
    masonrySideTop: compact ? 'w-full h-3 opacity-20' : 'w-28 h-4 opacity-20',
    masonrySideMain: compact ? 'w-full h-9 opacity-40' : 'w-28 h-14 opacity-40',
    masonrySideBottom: compact ? 'w-full h-1.5 opacity-15' : 'w-28 h-2 opacity-15',

    minimalTitleBar: compact ? 'w-24 h-2 opacity-40' : 'w-28 h-2.5 opacity-40',
    minimalBodyWide: compact ? 'w-28 h-1.5 opacity-20' : 'w-36 h-1.5 opacity-20',
    minimalBodyTiny: compact ? 'w-8 h-1.5 opacity-15' : 'w-10 h-1.5 opacity-15',

    coverMedia: compact ? 'w-16 h-12 opacity-20' : 'w-24 h-16 opacity-20',
    coverMeta: compact ? 'w-10 h-1 opacity-20' : 'w-12 h-1.5 opacity-20',
    coverTitle: compact ? 'w-20 h-1.5 opacity-40' : 'w-28 h-2 opacity-40',
    coverScore: compact ? 'w-3 h-1 opacity-30' : 'w-4 h-1.5 opacity-30',
    coverNote: compact ? 'w-5 h-1 opacity-20' : 'w-6 h-1.5 opacity-20',
  }
}
