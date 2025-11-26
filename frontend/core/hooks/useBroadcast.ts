import { pick } from 'ramda'

import useDashboard from '~/hooks/useDashboard'
import type { TBroadcastConfig } from '~/spec'

export default (): TBroadcastConfig => {
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
