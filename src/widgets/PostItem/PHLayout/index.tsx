import type { FC } from 'react'

import type { TPost } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import { upvoteArticle, previewArticle } from '~/signal'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import Upvote from '~/widgets/Upvote'
import ImgFallback from '~/widgets/ImgFallback'
import Img from '~/Img'

import Header from './Header'
import Body from './Body'

import useSalon from '../salon/ph_layout'

type TProps = {
  article: TPost
}

const DigestView: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { author } = article

  return (
    <div className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} className="top-6" />

      <div className={s.avatarWrapper}>
        <Img
          src={author.avatar}
          className={s.avatar}
          fallback={<ImgFallback size={6} user={author} />}
        />
      </div>
      <div className={s.main} onClick={() => previewArticle(article)}>
        <Header article={article} />
        <Body article={article} />
      </div>

      <div className={s.upvoteWrapper}>
        <Upvote
          type={UPVOTE_LAYOUT.POST_MINIMAL}
          count={article.upvotesCount}
          viewerHasUpvoted={article.viewerHasUpvoted}
          onAction={(viewerHasUpvoted) => upvoteArticle(article, viewerHasUpvoted)}
        />
      </div>
    </div>
  )
}

export default DigestView
