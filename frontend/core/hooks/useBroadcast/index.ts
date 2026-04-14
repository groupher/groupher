import { pick } from 'ramda'
import type { TBroadcastConf } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

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
