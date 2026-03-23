/*
 *
 * KanbanItem
 *
 */

import Link from 'next/link'
import { type FC, memo, useEffect, useState } from 'react'
import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD } from '~/const/thread'
import { getRandomInt } from '~/helper'
import { mockTags, mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import ArticleCatState from '~/unit/article-cat-state'
import TagsList from '~/unit/tags-list'
import Upvote from '~/unit/upvote'

import useSalon from '../salon/classic_layout/full'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { slug } = useCommunity()

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
      <Link href={`/${slug}/${THREAD.POST}/${article.innerId}`} scroll={false} className={s.title}>
        {article.title}
      </Link>
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
