import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, br, bg, avatar } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'p-5 pl-7 rounded-md w-full mt-7 border border-transparent',
      `hover:${br('divider')}`,
      bg('sandBox'),
    ),

    select: 'row-center wrap w-full -ml-2',
    block: cn(base.blockBase, 'w-72 h-24 scale-90'),
    blockActive: base.blockBaseActive,
    layout: 'column-align-both w-1/2',
    frame: 'column h-full w-full',
    header: 'column gap-2',
    headerRow: 'row-center justify-between gap-4',
    footer: 'row-center mt-auto justify-between',
    footerLeft: 'row-center gap-3',
    footerRight: 'row-center gap-2',
    icon: cnMerge(base.icon, 'static size-5'),
    commentIcon: cnMerge(base.icon, 'static size-3.5 mt-0.5'),
    avatarList: 'row-center gap-1 mt-0.5 -ml-1.5',
    userAvatar: cnMerge(base.bar, 'static size-4', avatar()),
    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    titleBar: 'w-16 opacity-30',
    bodyBar: 'w-28 h-2.5 opacity-40',
    sideBar: 'w-10 opacity-20',
    simpleMetric: 'w-10 opacity-30',
    tinyMetric: 'w-4 opacity-20',
    circle: cnMerge(base.circle, 'opacity-40'),
  }
}
