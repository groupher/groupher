import type { TArticle, TCommunity } from '~/spec'

import useSubStore from '~/hooks/useSubStore'
import useViewingArticle from '~/hooks/useViewingArticle'

type TRet = {
  article: TArticle
  community: TCommunity
  updateViewingCommunity: (args: TCommunity) => void
}

export default (): TRet | null => {
  const { community, updateViewingCommunity } = useSubStore('viewing')
  const { article } = useViewingArticle()

  return {
    article,
    community,
    updateViewingCommunity,
  }
}
