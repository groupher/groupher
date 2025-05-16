import type { TArticle, TCommunity, TThread } from '~/spec'

import useSubStore from '~/hooks/useSubStore'
import useViewingArticle from '~/hooks/useViewingArticle'

type TRet = {
  article: TArticle
  community: TCommunity
  updateViewingCommunity: (args: TCommunity) => void
  setActiveThread: (thread: TThread) => void
}

export default (): TRet | null => {
  const viewingStore = useSubStore('viewing')
  const { article } = useViewingArticle()
  const { community, updateViewingCommunity } = viewingStore

  const setActiveThread = (thread: TThread): void => {
    viewingStore.commit({ activeThread: thread })
  }

  return {
    article,
    community,
    updateViewingCommunity,
    setActiveThread,
  }
}
