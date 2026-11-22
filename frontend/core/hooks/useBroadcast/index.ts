import { pick } from 'ramda'

import type { TBroadcastConf } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

/** Exposes broadcast state and actions through the shared React hook boundary. */
export default function useBroadcast(): TBroadcastConf {
  const dsb$ = useDsb()

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
