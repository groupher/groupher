/*
 *
 * KanbanItem
 *
 */

import { type FC, memo, useState } from 'react'

import type { TArticle } from '~/spec'

import { mockTags, mockUsers } from '~/mock'
import { getRandomInt } from '~/helper'
import { UPVOTE_LAYOUT } from '~/const/layout'

import ArticleCatState from '~/widgets/ArticleCatState'
import Upvote from '~/widgets/Upvote'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/classic_layout/full'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const [titleIdx] = useState(() => getRandomInt(0, 7))

  const tags = mockTags(8)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <TagsList items={[tags[titleIdx]]} />
      </div>
      <div className={s.title}>{article.title}</div>
      <div className={s.desc}>{article.digest}</div>
      <div className={s.footer}>
        <Upvote
          count={article.upvotesCount}
          avatarList={mockUsers(3)}
          type={UPVOTE_LAYOUT.GENERAL}
        />
        <ArticleCatState cat={article.cat} top={1} />
      </div>
    </div>
  )
}

export default memo(KanbanItem)
