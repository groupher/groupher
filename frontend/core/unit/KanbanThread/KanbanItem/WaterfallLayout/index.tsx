/*
 *
 * KanbanItem
 *
 */

import Link from 'next/link'
import type { FC } from 'react'
import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD } from '~/const/thread'
import { mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import ArticleCatState from '~/unit/ArticleCatState'
import TagsList from '~/unit/TagsList'

import Upvote from '~/unit/Upvote'

import useSalon from '../salon/waterfall_layout'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { slug } = useCommunity()

  const { title, communityTags, cat, upvotesCount } = article

  return (
    <div className={s.wrapper}>
      <h4 className={s.title}>
        <Link
          href={`/${slug}/${THREAD.POST}/${article.innerId}`}
          scroll={false}
          data-preview-id={String(article.innerId)}
        >
          {title}
        </Link>
      </h4>
      <div className='grow' />
      <TagsList items={communityTags} right={1} />
      <ArticleCatState cat={cat} right={10} top={-1} />
      <div className={s.upvotes}>
        <Upvote count={upvotesCount} avatarList={mockUsers(3)} type={UPVOTE_LAYOUT.GENERAL} />
      </div>
    </div>
  )
}

export default KanbanItem
