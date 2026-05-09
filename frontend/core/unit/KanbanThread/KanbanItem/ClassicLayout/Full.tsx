/*
 *
 * KanbanItem
 *
 */

import Link from 'next/link'
import { type FC, memo, useEffect, useState } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import { getRandomInt } from '~/helper'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import { mockTags, mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import TagsList from '~/unit/TagsList'
import Upvote from '~/unit/Upvote'

import useSalon from '../salon/classic_layout/full'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
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
      <Link
        href={`/${slug}/${THREAD_PATH.POST}/${article.innerId}`}
        scroll={false}
        className={s.title}
        data-preview-id={String(article.innerId)}
      >
        {article.title}
      </Link>
      <div className={s.desc}>{article.digest}</div>
      <div className={s.footer}>
        <Upvote
          count={article.upvotesCount}
          avatarList={mockUsers(3)}
          type={UPVOTE_LAYOUT.GENERAL}
        />
        <ArticleCatStatus cat={article.cat} top={1} />
      </div>
    </div>
  )
}

export default memo(KanbanItem)
