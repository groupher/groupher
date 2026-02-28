import type { FC } from 'react'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'

import ArticleReadLabel from '~/widgets/ArticleReadLabel'

import useSalon from '../salon/cover_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { title } = article

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <button
          type='button'
          className={s.title}
          onClick={() => {
            previewArticle(article)
          }}
        >
          {title}
        </button>
      </div>
    </div>
  )
}

export default Header
