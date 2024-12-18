import { useState } from 'react'

import type { TArticle } from '~/spec'

import useSubStore from '~/hooks/useSubStore'
import useViewing from '~/hooks/useViewing'
import useAccount from '~/hooks/useAccount'

import { query } from '~/server'

import S from './schema'

type TRet = {
  article: TArticle
  loading: boolean
  loadArticle: () => void
}

export default (): TRet => {
  const viewing = useSubStore('viewing')
  const account = useAccount()
  const { article, community } = useViewing()

  const [loading, setLoading] = useState(false)

  const handleArticleLoaded = (article: TArticle): void => {
    // console.log('## # handleArticleRes: ', article)
    setLoading(false)
    const thread = article.meta.thread.toLowerCase()
    // const { document, ...restArticle } = article
    // store.mark({ document })
    // store.setViewing({ [thread]: mergeRight(store.viewingArticle, restArticle) })
    viewing.commit({ [thread]: article })

    setTimeout(() => {
      // console.log('## todo: sync article in list')
      // const { id, viewerHasUpvoted, views, upvotesCount } = article
      // store.syncArticle({
      //   id,
      //   viewerHasUpvoted,
      //   views,
      //   upvotesCount,
      //   viewerHasViewed: true,
      // })
    }, 500)
  }

  const loadArticle = (): void => {
    const userHasLogin = account.isLogin
    // 需要在 drawer 那里改动以后才能使用这个参数
    // const { originalCommunitySlug, innerId, meta } = article
    // const { originalCommunitySlug, meta } = article

    // const vaparams = { community: originalCommunitySlug, id: innerId, userHasLogin }
    const params = { community: community.slug, id: 21, userHasLogin }

    setLoading(true)
    // query(S.getArticle(meta.thread), params).then((res) => {
    query(S.getArticle('post'), params).then((res) => {
      // console.log('## getArticle: ', res)
      handleArticleLoaded(res.post)
    })
  }

  return {
    article,
    loading,
    loadArticle,
  }
}
