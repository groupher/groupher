import type { FC } from 'react'

import { THREAD_PATH } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'

import ArticleReadLabel from '../../ArticleReadLabel'
import useSalon from '../salon/cover_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { title } = article
  const { slug } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <CommunityPreviewLink
          className={s.title}
          href={`/${slug}/${THREAD_PATH.POST}/${article.innerId}`}
          previewId={article.innerId}
        >
          {title}
        </CommunityPreviewLink>
      </div>
    </div>
  )
}

export default Header
