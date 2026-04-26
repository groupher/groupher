import { useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TArticle, TArticleLoad } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useArticle from '~/stores/article/hooks'
import { thread2Path } from '~/utils/thread'

import S from './schema'

type TRet = {
  article: TArticle
  loading: boolean
  loadArticle: (p: TArticleLoad) => void
}

export default function useLogic(): TRet {
  const article$ = useArticle()
  const account = useAccount()
  const { article } = article$

  const { query } = useGraphQLClient()

  const [loading, setLoading] = useState(false)

  const handleArticleLoaded = (article: TArticle): void => {
    // console.log('## # handleArticleRes: ', article)
    setLoading(false)
    const thread = thread2Path(article.meta.thread)
    // const { document, ...restArticle } = article
    // store.mark({ document })
    // store.setViewing({ [thread]: mergeRight(store.viewingArticle, restArticle) })
    article$.commit({ [thread]: article })

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

  const loadArticle = ({ community, thread, innerId }: TArticleLoad): void => {
    const userHasLogin = account.isLogin
    // 需要在 drawer 那里改动以后才能使用这个参数
    // console.log("## load article: ", article)
    // const { communitySlug, innerId, meta } = article
    // const { communitySlug, meta } = article
    const params = {
      article: {
        innerId,
        community,
        thread,
      },
      userHasLogin,
    }

    setLoading(true)
    // query(S.getArticle(meta.thread), params).then((res) => {
    query(S.getArticle(thread), params).then((res) => {
      handleArticleLoaded(res.post)
    })
  }

  return {
    article,
    loading,
    loadArticle,
  }
}
