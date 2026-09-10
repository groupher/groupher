import { type FC, memo } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TArticle } from '~/spec'
import Upvote from '~/unit/Upvote'

import ArticleBaseStats from '../ArticleBaseStats'
import useSalon from './salon/article_info'

type TProps = {
  article: TArticle
}

const ArticleInfo: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { meta } = article
  const { count, isUpvoted, toggle } = useArticleUpvote(article)

  return (
    <div className={s.wrapper}>
      <div className={s.baseWrapper}>
        <Upvote
          type={UPVOTE_LAYOUT.DEFAULT}
          count={count}
          avatarList={meta.latestUpvotedUsers}
          noLazyLoad
          viewerHasUpvoted={isUpvoted}
          onAction={() => toggle()}
        />
        <div className='grow' />
        <ArticleBaseStats article={article} container='drawer' />
      </div>
    </div>
  )
}

export default memo(ArticleInfo)
