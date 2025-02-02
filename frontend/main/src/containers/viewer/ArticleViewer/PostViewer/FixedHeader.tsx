import { type FC, memo } from 'react'

import type { TArticle } from '~/spec'

import { UPVOTE_LAYOUT } from '~/const/layout'

import Upvote from '~/widgets/Upvote'
import ArticleCatState from '~/widgets/ArticleCatState'
// import ArticleBaseStats from '~/widgets/ArticleBaseStats'

import useSalon from '../salon/post_viewer/fixed_header'

type TProps = {
  article: TArticle
  visible?: boolean
  footerVisible: boolean
}

const FixedHeader: FC<TProps> = ({ article, visible, footerVisible }) => {
  const s = useSalon({ visible })
  const { upvotesCount, viewerHasUpvoted, cat, state } = article

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <Upvote
          count={upvotesCount}
          viewerHasUpvoted={viewerHasUpvoted}
          type={UPVOTE_LAYOUT.FIXED_HEADER}
          right={6}
        />
        <div className={s.articleTitle}>{article.title}</div>
      </div>
      <ArticleCatState cat={cat} state={state} />
      <div className={s.divider} />
    </div>
  )
}

export default memo(FixedHeader)
