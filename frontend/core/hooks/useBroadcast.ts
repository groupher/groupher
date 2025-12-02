import { pick } from 'ramda'

import useDashboard from '~/hooks/useDashboard'
import type { TBroadcastConf } from '~/spec'

export default (): TBroadcastConf => {
  const store = useDashboard()

  return pick(
    [
      'broadcastLayout',
      'broadcastBg',
      'broadcastEnable',
      'broadcastArticleLayout',
      'broadcastArticleBg',
      'broadcastArticleEnable',
    ],
    store,
  )
}
