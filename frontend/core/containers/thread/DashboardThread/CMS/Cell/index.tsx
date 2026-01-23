'use client'

import * as React from 'react'

import Img from '~/Img'
import PulseSVG from '~/icons/Pulse'
import { previewArticle } from '~/signal'
import type { TArticle } from '~/spec'
import ArticleCatState from '~/widgets/ArticleCatState'
import TagsList from '~/widgets/TagsList'
import TimeAgo from '~/widgets/TimeAgo'
import useSalon, { cn } from '../../salon/cms/cell'

const EMPTY_ARR: any[] = []

export const StateCell = React.memo(function StateCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()
  const { cat, state } = rowData ?? {}

  if (!state) return <div />

  return (
    <div className={s.stateWrapper}>
      <ArticleCatState cat={cat} state={state} smaller />
    </div>
  )
})

export const ArticleCell = React.memo(function ArticleCell({ rowData }: { rowData: TArticle }) {
  const s = useSalon()

  return (
    <div className='w-full overflow-hidden'>
      <button
        type='button'
        className={cn(s.articleTitle, 'truncate w-full text-left')}
        onClick={() => previewArticle(rowData)}
      >
        ({rowData.innerId}) {rowData.title}
      </button>

      <div className='w-full overflow-hidden whitespace-nowrap'>
        <TagsList items={rowData.articleTags ?? EMPTY_ARR} left={0} />
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
