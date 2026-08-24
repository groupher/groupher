'use client'

import * as React from 'react'

import { DSB_ROUTE } from '~/const/route'
import PulseSVG from '~/icons/Pulse'
import Img from '~/Img'
import { Link as PlatformLink } from '~/platform'
import type { TArticle, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import TimeAgo from '~/ui/TimeAgo'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import TagsList from '~/unit/TagsList'
import { thread2Path } from '~/utils/thread'

import useSalon, { cn } from './salon'

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
  const { slug } = useCommunity()

  return (
    <div className='w-full overflow-hidden'>
      <PlatformLink
        route={{
          app: 'dsb',
          community: slug,
          path: `${thread2Path(rowData.meta.thread)}/${rowData.innerId}`,
        }}
        className={cn(s.articleTitle, 'inline-block truncate w-full text-left')}
      >
        ({rowData.innerId}) {rowData.title}
      </PlatformLink>

      <div className='w-full overflow-hidden whitespace-nowrap'>
        <TagsList items={rowData.communityTags ?? EMPTY_ARR} left={0} />
      </div>
      <PlatformLink
        route={{
          app: 'dsb',
          community: slug,
          path: `${DSB_ROUTE.ACTIVITY}?subjectQuery=${encodeURIComponent(rowData.title || '')}`,
        }}
        className='text-accent text-xs'
      >
        Activity
      </PlatformLink>
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
