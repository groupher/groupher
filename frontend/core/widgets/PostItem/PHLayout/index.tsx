import type { FC } from 'react'
import { UPVOTE_LAYOUT } from '~/const/layout'
import Img from '~/Img'

import { previewArticle, upvoteArticle } from '~/signal'
import type { TPost } from '~/spec'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import ImgFallback from '~/widgets/ImgFallback'
import Upvote from '~/widgets/Upvote'
import useSalon from '../salon/ph_layout'
import Body from './Body'
import Header from './Header'

type TProps = {
  article: TPost
}

const DigestView: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { author } = article

  return (
    <div className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} className='top-6' />

      <div className={s.avatarWrapper}>
        <Img src={author.avatar} className={s.avatar} fallback={<ImgFallback user={author} />} />
      </div>
      <button className={s.main} onClick={() => previewArticle(article)}>
        <Header article={article} />
        <Body article={article} />
      </button>

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
