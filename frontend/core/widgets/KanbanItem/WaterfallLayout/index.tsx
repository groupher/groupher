/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'
import { useRouter } from 'next/navigation'

import type { TArticle } from '~/spec'
import useCommunity from '~/hooks/useCommunity'

import { UPVOTE_LAYOUT } from '~/const/layout'
import ArticleCatState from '~/widgets/ArticleCatState'
import TagsList from '~/widgets/TagsList'

import { mockUsers } from '~/mock'

import Upvote from '~/widgets/Upvote'

import useSalon from '../salon/waterfall_layout'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const router = useRouter()
  const { slug } = useCommunity()

  const { title, communityTags, cat, upvotesCount } = article

  return (
    <div className={s.wrapper}>
      <h4
        className={s.title}
        onClick={() =>
          router.push(`/${slug}/${article.meta.thread.toLowerCase()}/${article.innerId}`, { scroll: false })
        }
      >
        {title}
      </h4>
      <div className="grow" />
      <TagsList items={communityTags} right={1} />
      <ArticleCatState cat={cat} right={10} top={-1} />
      <div className={s.upvotes}>
        <Upvote count={upvotesCount} avatarList={mockUsers(3)} type={UPVOTE_LAYOUT.GENERAL} />
      </div>
    </div>
  )
}

export default KanbanItem
