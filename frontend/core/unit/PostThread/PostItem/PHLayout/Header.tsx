import type { FC } from 'react'

import { THREAD_PATH } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'
import TagsList from '~/unit/TagsList'

import ArticleReadLabel from '../../ArticleReadLabel'
import useSalon from '../salon/ph_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { title, communityTags } = article
  const s = useSalon()
  const { slug } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.brief}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <CommunityPreviewLink
          className={s.title}
          href={`/${slug}/${THREAD_PATH.POST}/${article.innerId}`}
          previewId={article.innerId}
        >
          {title}
        </CommunityPreviewLink>
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={12} />
      </div>
    </div>
  )
}

export default Header
