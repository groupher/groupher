'use client'

import { useRouter } from 'next/navigation'
import * as React from 'react'

import PulseSVG from '~/icons/Pulse'
import Img from '~/Img'
import type { TArticle, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import TagsList from '~/unit/TagsList'
import { thread2Path } from '~/utils/thread'
import TimeAgo from '~/widgets/TimeAgo'

import useSalon, { cn } from '../salon/cell'

const EMPTY_ARR: TTag[] = []

export const StatusCell = React.memo(function StatusCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()
  const { cat, status } = rowData ?? {}

  if (!status) return <div />

  return (
    <div className={s.statusWrapper}>
      <ArticleCatStatus cat={cat} status={status} smaller />
    </div>
  )
})

export const ArticleCell = React.memo(function ArticleCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()
  const { push } = useRouter()
  const { slug } = useCommunity()

  return (
    <div className='w-full overflow-hidden'>
      <button
        type='button'
        className={cn(s.articleTitle, 'truncate w-full text-left')}
        onClick={() =>
          push(`/${slug}/${thread2Path(rowData.meta.thread)}/${rowData.innerId}`, {
            scroll: false,
          })
        }
      >
        ({rowData.innerId}) {rowData.title}
      </button>

      <div className='w-full overflow-hidden whitespace-nowrap'>
        <TagsList items={rowData.communityTags ?? EMPTY_ARR} left={0} />
      </div>
    </div>
  )
})

export const AuthorCell = React.memo(function AuthorCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()
  const author = rowData?.author

  if (!author) return <div />

  return (
    <div className={s.author}>
      <Img className={s.authorAvatar} src={author.avatar} />
      <div className={s.nickname}>{author.nickname}</div>
    </div>
  )
})

export const DateCell = React.memo(function DateCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()
  const { insertedAt, activeAt } = rowData ?? {}

  return (
    <div className={s.dateCell}>
      <div className={s.dateItem}>
        <TimeAgo datetime={insertedAt} />
      </div>
      <div className={s.dateItem}>
        <PulseSVG className={s.pulseIcon} />
        <TimeAgo datetime={activeAt} />
      </div>
    </div>
  )
})
