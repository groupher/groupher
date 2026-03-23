import Link from 'next/link'
import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import ArticleReadLabel from '../../ArticleReadLabel'

import useSalon from '../salon/cover_layout/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { title } = article
  const { slug } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <ArticleReadLabel viewed={article.viewerHasViewed} />
        <Link
          className={s.title}
          href={`/${slug}/${THREAD.POST}/${article.innerId}`}
          scroll={false}
        >
          {title}
        </Link>
      </div>
    </div>
  )
}

export default Header
