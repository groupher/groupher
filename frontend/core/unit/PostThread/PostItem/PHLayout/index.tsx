import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import Img from '~/Img'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TPost } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'
import Upvote from '~/unit/Upvote'

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
  const { count, isUpvoted, toggle } = useArticleUpvote(article)

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
          count={count}
          viewerHasUpvoted={isUpvoted}
          onAction={() => toggle()}
        />
      </div>
    </div>
  )
}

export default DigestView
