import useTwBelt from '~/hooks/useTwBelt'

import useBroadcast from '../../../logic/useBroadcast'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()
  const { broadcastBg } = useBroadcast()

  return {
    wrapper: cn('w-full'),
    enableDesc: 'w-10/12 leading-relaxed',
    bgLabel: cn('align-both size-8 circle border pointer', rainbow(broadcastBg, 'border')),
    colorBall: cn('size-6 circle', rainbow(broadcastBg, 'bg')),
    label: cn('text-sm w-28 min-w-28', fg('text.digest')),
    item: 'row-center mb-5',
  }
}
