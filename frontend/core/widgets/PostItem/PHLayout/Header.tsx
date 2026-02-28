import type { FC } from 'react'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/ph_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { title, communityTags } = article
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.brief}>
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
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={12} />
      </div>
    </div>
  )
}

export default Header
