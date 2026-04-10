import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, bg, shadow, fill, avatar } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('h-14 rounded-md px-1.5 py-1 pt-2.5', bg('alphaBg'), shadow('md')),
    frame: 'flex h-full w-full flex-col',
    header: 'flex flex-col gap-1',
    headerRow: 'flex items-end justify-between gap-2',
    footer: 'mt-auto row-center justify-between',
    footerLeft: 'row-center gap-1.5',
    footerRight: 'row-center gap-1.5',
    bar: cnMerge(base.bar, 'static h-1 w-20 opacity-40 saturate-0'),
    titleBar: 'w-10 opacity-15',
    bodyBar: 'h-1.5 w-14 opacity-20',
    sideBar: 'w-5 opacity-15',
    simpleMetric: 'h-1 w-6 opacity-10',
    tinyMetric: 'h-1 w-4 opacity-10',
    icon: cn('static size-3.5 opacity-30', fill('digest')),
    commentIcon: cn('static size-2 opacity-45 mt-0.5', fill('digest')),
    avatarList: 'row-center gap-0.5 mt-0.5 -ml-0.5',
    userAvatar: cnMerge(base.bar, 'static size-2 saturate-0 opacity-15', avatar()),
  }
}
