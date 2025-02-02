import type { FC } from 'react'

import type { TPost } from '~/spec'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import { THREAD } from '~/const/thread'

import { previewArticle } from '~/signal'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/ph_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { innerId, title, articleTags } = article
  const { slug } = useViewingCommunity()
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
        <TagsList items={articleTags} left={12} />
      </div>
    </div>
  )
}

export default Header
