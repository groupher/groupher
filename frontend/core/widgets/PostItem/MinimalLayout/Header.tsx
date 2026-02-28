import type { FC } from 'react'
import SIZE from '~/const/size'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import CommentsCount from '~/widgets/CommentsCount'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/minimal_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { title, commentsCount, communityTags } = article

  return (
    <article className={s.wrapper}>
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
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={1} />
        <div className='grow' />
        {commentsCount !== 0 && <CommentsCount count={commentsCount} size={SIZE.MEDIUM} />}
      </div>
    </article>
  )
}

export default Header
