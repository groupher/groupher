import { pick } from 'ramda'

import type { TBroadcastConf } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

/** Exposes broadcast state and actions through the shared React hook boundary. */
export default function useBroadcast(): TBroadcastConf {
  const dsb$ = useDashboard()

  return pick(
    [
      'broadcastLayout',
      'broadcastBg',
      'broadcastCustomBg',
      'broadcastEnable',
      'broadcastArticleLayout',
      'broadcastArticleBg',
      'broadcastArticleCustomBg',
      'broadcastArticleEnable',
    ],
    dsb$,
  )
}
