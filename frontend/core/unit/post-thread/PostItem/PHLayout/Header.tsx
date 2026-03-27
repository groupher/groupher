import Link from 'next/link'
import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import TagsList from '~/unit/tags-list'
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
        <Link
          className={s.title}
          href={`/${slug}/${THREAD.POST}/${article.innerId}`}
          scroll={false}
          data-preview-id={String(article.innerId)}
        >
          {title}
        </Link>
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={12} />
      </div>
    </div>
  )
}

export default Header
