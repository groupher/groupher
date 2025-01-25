import type { FC } from 'react'

import type { TPost } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import { previewArticle, upvoteArticle } from '~/signal'

import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import Upvote from '~/widgets/Upvote'

import Header from './Header'
import Footer from './Footer'

import useSalon from '../salon/minimal_layout'

type TProps = {
  article: TPost
}

const DigestView: FC<TProps> = ({ article }) => {
  const s = useSalon()
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
      <div className={s.main} onClick={() => previewArticle(article)}>
        <Header article={article} />
        <div className={s.digest}>{article.digest}</div>
        <Footer article={article} />
      </div>
    </article>
  )
}

export default DigestView
