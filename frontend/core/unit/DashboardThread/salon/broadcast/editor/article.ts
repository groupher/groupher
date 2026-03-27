import useTwBelt from '~/hooks/useTwBelt'

import useBroadcast from '../../../logic/useBroadcast'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()
  const { broadcastArticleBg } = useBroadcast()

  return {
    wrapper: 'w-full',

    bgLabel: cn('align-both size-8 circle border pointer', rainbow(broadcastArticleBg, 'border')),
    colorBall: cn('size-6 circle', rainbow(broadcastArticleBg, 'bg')),
    label: cn('text-sm w-28 min-w-28', fg('digest')),
    item: 'row-center mb-5',
  }
}
