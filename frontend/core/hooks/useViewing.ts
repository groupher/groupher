import useGeneral from '~/hooks/useGeneral'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TArticle, TCommunity, TThread } from '~/spec'

type TRet = {
  article: TArticle
  community: TCommunity
  updateViewingCommunity: (args: TCommunity) => void
  setActiveThread: (thread: TThread) => void
}

export default (): TRet | null => {
  const viewingStore = useGeneral()
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
