import { pick } from 'ramda'

import useDashboard from '~/hooks/useDashboard'
import type { TBroadcastConf } from '~/spec'

export default function useBroadcast(): TBroadcastConf {
  const dsb$ = useDashboard()

  return pick(
    [
      'broadcastLayout',
      'broadcastBg',
      'broadcastEnable',
      'broadcastArticleLayout',
      'broadcastArticleBg',
      'broadcastArticleEnable',
    ],
    dsb$,
  )
}
