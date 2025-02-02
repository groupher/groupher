import type { FC } from 'react'

import type { TPost } from '~/spec'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import SIZE from '~/const/size'
import { THREAD } from '~/const/thread'

import { previewArticle } from '~/signal'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'

import TagsList from '~/widgets/TagsList'
import CommentsCount from '~/widgets/CommentsCount'

import useSalon from '../salon/minimal_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { slug } = useViewingCommunity()
  const { innerId, title, commentsCount, articleTags } = article

  return (
    <article className={s.wrapper}>
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
        {/*  @ts-ignore */}
        <TagsList items={articleTags} left={1} />
        <div className="grow" />
        {commentsCount !== 0 && <CommentsCount count={commentsCount} size={SIZE.MEDIUM} />}
      </div>
    </article>
  )
}

export default Header
