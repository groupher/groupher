import type { FC } from 'react'

import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import type { TArticleState, TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'

import useSalon from '../salon/quora_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  viewModel: TArticleState<TPost>
}

const PostItem: FC<TProps> = ({ viewModel }) => {
  const { content: article, stats, viewerState } = viewModel
  const innerId = String(article.innerId ?? '')
  const isActive = usePreviewItemActive(innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
  const { slug } = useCommunity()

  return (
    <article className={s.wrapper}>
      <Header article={article} stats={stats} viewerState={viewerState} />
      <CommunityPreviewLink
        className={s.digest}
        href={`/${slug}/${THREAD_PATH.POST}/${innerId}`}
        previewId={innerId}
      >
        {article.digest}
      </CommunityPreviewLink>
      <Footer
        article={article}
        stats={stats}
        viewerState={viewerState}
        ticketProgress={viewModel.ticketProgress}
      />
    </article>
  )
}

export default PostItem
