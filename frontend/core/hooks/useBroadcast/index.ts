import { pick } from 'ramda'

import useDashboard from '~/stores/dashboard/hooks'
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
