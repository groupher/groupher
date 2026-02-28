/*
 *
 * KanbanItem
 *
 */

import { type FC, memo, useState, useEffect } from 'react'

import type { TArticle } from '~/spec'

import { UPVOTE_LAYOUT } from '~/const/layout'

import { mockTags, mockUsers } from '~/mock'
import { previewArticle } from '~/signal'
import { getRandomInt } from '~/helper'

import CommentsCount from '~/widgets/CommentsCount'

import ArticleCatState from '~/widgets/ArticleCatState'
import Upvote from '~/widgets/Upvote'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/classic_layout/simple'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const [titleIdx, setTitleIdx] = useState(0)

  useEffect(() => {
    setTitleIdx(getRandomInt(0, 7))
  }, [])

  const tags = mockTags(8)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <TagsList items={[tags[titleIdx]]} />
      </div>
      <button type='button' className={s.title} onClick={() => previewArticle(article)}>
        {article.title}
      </button>
      <div className={s.footer}>
        <div className="row-center">
          <Upvote
            count={article.upvotesCount}
            avatarList={mockUsers(3)}
            type={UPVOTE_LAYOUT.SIMPLE}
          />
          <div className="mr-4" />
          {article.commentsCount !== 0 && (
            <CommentsCount count={article.commentsCount} size="medium" />
          )}
        </div>
        <ArticleCatState cat={article.cat} />
      </div>
    </div>
  )
}

export default memo(KanbanItem)
