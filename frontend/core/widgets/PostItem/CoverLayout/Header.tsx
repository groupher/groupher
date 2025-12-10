import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import useCommunity from '~/hooks/useCommunity'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'

import ArticleReadLabel from '~/widgets/ArticleReadLabel'

import useSalon from '../salon/cover_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const { slug } = useCommunity()

  const { innerId, title } = article

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
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
      </div>
    </div>
  )
}

export default Header
