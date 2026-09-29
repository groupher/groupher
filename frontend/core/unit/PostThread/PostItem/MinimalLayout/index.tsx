import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TArticleState, TPost } from '~/spec'
import Upvote from '~/unit/Upvote'

import ArticlePinLabel from '../../ArticlePinLabel'
import useSalon from '../salon/minimal_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  viewModel: TArticleState<TPost>
}

const DigestView: FC<TProps> = ({ viewModel }) => {
  const { content: article, stats, viewerState } = viewModel
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
  const { meta } = article
  const { count, isUpvoted, toggle } = useArticleUpvote(article, stats, viewerState)

  return (
    <article className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} />
      <div className={s.upvoteWrapper}>
        <Upvote
          count={count}
          avatarList={meta.latestUpvotedUsers}
          viewerHasUpvoted={isUpvoted}
          type={UPVOTE_LAYOUT.POST_MINIMAL}
          onAction={() => toggle()}
          left={-2}
          top={-1}
        />
      </div>
      <div className={s.main}>
        <Header article={article} stats={stats} viewerState={viewerState} />
        <div className={s.digest}>{article.digest}</div>
        <Footer article={article} />
      </div>
    </article>
  )
}

export default DigestView
