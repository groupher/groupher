import type { FC } from 'react'
import { useRouter } from 'next/navigation'
import SIZE from '~/const/size'
import { THREAD } from '~/const/thread'
import useCommunity from '~/hooks/useCommunity'
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
  const { slug } = useCommunity()
  const router = useRouter()

  return (
    <article className={s.wrapper}>
      <div className={s.main}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <button
          type='button'
          className={s.title}
          onClick={() => {
            router.push(`/${slug}/${THREAD.POST}/${article.innerId}`, { scroll: false })
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
