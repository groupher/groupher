import { type FC, memo } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import type { TChangelog, TArticleStats, TArticleViewerState } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import Upvote from '~/unit/Upvote'
// import ArticleBaseStats from '~/ui/ArticleBaseStats'

import useSalon from './salon/fixed_header'

type TProps = {
  article: TChangelog
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  visible?: boolean
  footerVisible: boolean
}

const FixedHeader: FC<TProps> = ({
  article,
  stats,
  viewerState,
  visible,
  footerVisible: _footerVisible,
}) => {
  const s = useSalon({ visible: Boolean(visible) })
  const { cat, status } = article

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <Upvote
          count={stats?.upvotesCount}
          viewerHasUpvoted={Boolean(viewerState.viewerHasUpvoted)}
          type={UPVOTE_LAYOUT.FIXED_HEADER}
          right={6}
        />
        <div className={s.articleTitle}>{article.title}</div>
      </div>
      <ArticleCatStatus cat={cat} status={status} />
      <div className={s.divider} />
    </div>
  )
}

export default memo(FixedHeader)
