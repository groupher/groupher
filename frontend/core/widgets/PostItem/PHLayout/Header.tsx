import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import useCommunity from '~/hooks/useCommunity'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/ph_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { innerId, title, communityTags } = article
  const { slug } = useCommunity()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.brief}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <a
          className={s.title}
          onClick={(e) => {
            e.preventDefault()
            previewArticle(article)
          }}
          href={`/${slug}/${THREAD.POST}/${innerId}`}
        >
          {title}
        </a>
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={12} />
      </div>
    </div>
  )
}

export default Header
