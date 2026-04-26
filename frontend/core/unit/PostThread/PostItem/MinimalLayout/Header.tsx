import Link from 'next/link'
import type { FC } from 'react'

import SIZE from '~/const/size'
import { THREAD_PATH } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommentsCount from '~/unit/CommentsCount'
import TagsList from '~/unit/TagsList'

import ArticleReadLabel from '../../ArticleReadLabel'
import useSalon from '../salon/minimal_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { title, commentsCount, communityTags } = article
  const { slug } = useCommunity()

  return (
    <article className={s.wrapper}>
      <div className={s.main}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <Link
          className={s.title}
          href={`/${slug}/${THREAD_PATH.POST}/${article.innerId}`}
          scroll={false}
          data-preview-id={String(article.innerId)}
        >
          {title}
        </Link>
        {/*  @ts-ignore */}
        <TagsList items={communityTags} left={1} />
        <div className='grow' />
        {commentsCount !== 0 && <CommentsCount count={commentsCount} size={SIZE.MEDIUM} />}
      </div>
    </article>
  )
}

export default Header
