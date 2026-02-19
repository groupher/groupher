/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import type { TArticle } from '~/spec'

import { UPVOTE_LAYOUT } from '~/const/layout'
import ArticleCatState from '~/widgets/ArticleCatState'
import TagsList from '~/widgets/TagsList'

import { mockUsers } from '~/mock'
import { previewArticle } from '~/signal'

import Upvote from '~/widgets/Upvote'

import useSalon from '../salon/waterfall_layout'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const { title, communityTags, cat, upvotesCount } = article

  return (
    <div className={s.wrapper}>
      <h4 className={s.title} onClick={() => previewArticle(article)}>
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
