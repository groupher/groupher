import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import Img from '~/Img'
import { upvoteArticle } from '~/signal'
import type { TPost } from '~/spec'
import Upvote from '~/unit/Upvote'
import ImgFallback from '~/widgets/ImgFallback'

import ArticlePinLabel from '../../ArticlePinLabel'
import useSalon from '../salon/ph_layout'
import Body from './Body'
import Header from './Header'

type TProps = {
  article: TPost
}

const DigestView: FC<TProps> = ({ article }) => {
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
  const { author } = article

  return (
    <div className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} className='top-6' />

      <div className={s.avatarWrapper}>
        <Img src={author.avatar} className={s.avatar} fallback={<ImgFallback user={author} />} />
      </div>
      <div className={s.main}>
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
