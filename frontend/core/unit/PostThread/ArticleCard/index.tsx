import type { FC } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { cutRest } from '~/fmt'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import type { TArticleState } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'

import ArticleImgWindow from '../ArticleImgWindow'
import ArticlePinLabel from '../ArticlePinLabel'
import ArticleReadLabel from '../ArticleReadLabel'
import Footer from './Footer'
import useSalon from './salon'

type TProps = {
  viewModel: TArticleState
}

const ArticleCard: FC<TProps> = ({ viewModel }) => {
  const { content: data, stats, viewerState } = viewModel
  const isActive = usePreviewItemActive(data.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })

  const { slug } = useCommunity()
  const { innerId, title, digest, isPinned } = data

  return (
    <div className={s.wrapper}>
      <div className={s.pinHintDot}>
        <ArticlePinLabel isPinned={isPinned} />
      </div>

      <div className={s.viewHintDot}>
        <ArticleReadLabel viewed={viewerState.viewerHasViewed} top={0} right={0} />
      </div>

      <div className='mt-1' />
      <CommunityPreviewLink
        className={s.titleLink}
        href={`/${slug}/${THREAD_PATH.POST}/${innerId}`}
        previewId={innerId}
      >
        {title}
      </CommunityPreviewLink>

      <CommunityPreviewLink href={`/${slug}/${THREAD_PATH.POST}/${innerId}`} previewId={innerId}>
        {cutRest(digest, 150)}
      </CommunityPreviewLink>

      <div className='mt-1' />
      <ArticleImgWindow />
      <div className='mt-4' />
      <div className='grow' />
      <Footer article={data} stats={stats} viewerState={viewerState} />
    </div>
  )
}

export default ArticleCard
