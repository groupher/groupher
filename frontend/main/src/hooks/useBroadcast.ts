import { pick } from 'ramda'

import useSubStore from '~/hooks/useSubStore'
import type { TBroadcastConfig } from '~/spec'

export default (): TBroadcastConfig => {
  const store = useSubStore('dashboard')

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
