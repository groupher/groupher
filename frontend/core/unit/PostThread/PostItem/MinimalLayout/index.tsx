import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import { upvoteArticle } from '~/signal'
import type { TPost } from '~/spec'
import Upvote from '~/unit/Upvote'

import ArticlePinLabel from '../../ArticlePinLabel'
import useSalon from '../salon/minimal_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  article: TPost
}

const DigestView: FC<TProps> = ({ article }) => {
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
  const { upvotesCount, meta, viewerHasUpvoted } = article

  return (
    <article className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} />
      <div className={s.upvoteWrapper}>
        <Upvote
          count={upvotesCount}
          avatarList={meta.latestUpvotedUsers}
          viewerHasUpvoted={viewerHasUpvoted}
          type={UPVOTE_LAYOUT.POST_MINIMAL}
          onAction={(viewerHasUpvoted) => upvoteArticle(article, viewerHasUpvoted)}
          left={-2}
          top={-1}
        />
      </div>
      <div className={s.main}>
        <Header article={article} />
        <div className={s.digest}>{article.digest}</div>
        <Footer article={article} />
      </div>
    </article>
  )
}

export default DigestView
