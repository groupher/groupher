import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import Upvote from '~/unit/Upvote'
import ViewsCount from '~/unit/ViewsCount'

import useSalon from '../salon/quora_layout/footer'

type TProps = {
  article: TPost
}

const Footer: FC<TProps> = ({ article }) => {
  const { meta } = article

  const s = useSalon()
  const { count, isUpvoted, toggle } = useArticleUpvote(article)

  return (
    <div className={s.wrapper}>
      <Upvote
        count={count}
        avatarList={meta.latestUpvotedUsers}
        onAction={() => toggle()}
        viewerHasUpvoted={isUpvoted}
        type={UPVOTE_LAYOUT.GENERAL}
      />
      {article.cat && <ArticleCatStatus left={2} cat={article.cat} status={article.status} />}
      <ViewsCount count={article.articleStats?.views} left={3} />
    </div>
  )
}

export default Footer
