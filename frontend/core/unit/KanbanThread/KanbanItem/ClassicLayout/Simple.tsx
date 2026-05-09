/*
 *
 * KanbanItem
 *
 */

import { useRouter } from 'next/navigation'
import { type FC, memo, useEffect, useState } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import { getRandomInt } from '~/helper'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import { mockTags, mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import CommentsCount from '~/unit/CommentsCount'
import TagsList from '~/unit/TagsList'
import Upvote from '~/unit/Upvote'

import useSalon from '../salon/classic_layout/simple'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })
  const router = useRouter()
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
      <button
        type='button'
        className={s.title}
        data-preview-id={String(article.innerId)}
        onClick={() =>
          router.push(`/${slug}/${THREAD_PATH.POST}/${article.innerId}`, { scroll: false })
        }
      >
        {article.title}
      </button>
      <div className={s.footer}>
        <div className='row-center'>
          <Upvote
            count={article.upvotesCount}
            avatarList={mockUsers(3)}
            type={UPVOTE_LAYOUT.SIMPLE}
          />
          <div className='mr-4' />
          {article.commentsCount !== 0 && (
            <CommentsCount count={article.commentsCount} size='medium' />
          )}
        </div>
        <ArticleCatStatus cat={article.cat} status={article.status} />
      </div>
    </div>
  )
}

export default memo(KanbanItem)
