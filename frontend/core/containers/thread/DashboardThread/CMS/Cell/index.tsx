// import type { FC } from 'react'

import { Cell } from 'rsuite-table'
import TimeAgo from '~/widgets/TimeAgo'
import Link from 'next/link'

import { previewArticle } from '~/signal'
import { COMMUNITY_STATUS } from '~/const/mode'

import Img from '~/Img'
import PulseSVG from '~/icons/Pulse'
import Checker from '~/widgets/Checker'
import ArticleCatState from '~/widgets/ArticleCatState'
import Button from '~/widgets/Buttons/Button'
import TagsList from '~/widgets/TagsList'

// import { mockTags } from '~/mock'

import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon, { cn } from '../../salon/cms/cell'

export const CheckCell = ({ rowData, ...props }) => {
  const { batchSelect } = useCMSInfo()
  // const { cat, state } = rowData
  const { id, _checked } = rowData

  return (
    <Cell {...props}>
      <Checker
        checked={_checked}
        size="small"
        top={5}
        onChange={(checked) => batchSelect(id, checked)}
      />
    </Cell>
  )
}

export const StateCell = ({ rowData, ...props }) => {
  const s = useSalon()
  const { cat, state } = rowData

  return (
    <Cell {...props}>
      <div className={s.stateWrapper}>
        <ArticleCatState cat={cat} state={state} left={-8} smaller />
      </div>
    </Cell>
  )
}

export const CommunityCell = ({ rowData, ...props }) => {
  const s = useSalon()
  const { logo, title, slug } = rowData

  return (
    <Cell {...props}>
      <div className="row">
        <Img className={s.communityLogo} src={logo} />
        <div>
          <div className={s.communityTitle}>{title}</div>
          <Link className={s.communitySlug} href={`/${slug}`}>
            /{slug}
          </Link>
        </div>
      </div>
    </Cell>
  )
}

export const PendingCell = ({ rowData, ...props }) => {
  const s = useSalon()
  const { pending } = rowData

  const _pending = pending === COMMUNITY_STATUS.PENDING

  return (
    <Cell {...props} align="center">
      <div className={s.actionCell}>
        <div className={cn(s.pending, _pending && s.pendingBlocked)}>
          {_pending ? '待审核' : '正常'}
        </div>
        <Button className={s.switchButton} size="tiny" ghost>
          开关
        </Button>
      </div>
    </Cell>
  )
}

export const ArticleCell = ({ rowData, ...props }) => {
  const s = useSalon()

  return (
    <Cell {...props}>
      <>
        <div className={s.articleTitle} onClick={() => previewArticle(rowData)}>
          {rowData.title}
        </div>
        <TagsList items={rowData.articleTags} left={0} />
      </>
    </Cell>
  )
}

export const AuthorDateCell = ({ rowData, ...props }) => {
  const s = useSalon()
  return (
    <Cell {...props}>
      <div className={s.author}>
        <Img className={s.authorAvatar} src={rowData.author.avatar} />
        <div className={s.nickname}>{rowData.author.nickname}</div>
      </div>
    </Cell>
  )
}

export const DateCell = ({ rowData, ...props }) => {
  const s = useSalon()
  const { insertedAt, activeAt } = rowData

  return (
    <Cell {...props}>
      <div className={s.dateCell}>
        <div className={s.dateItem}>
          {/* <PublishIcon /> */}
          <TimeAgo datetime={insertedAt} locale="zh_CN" />
        </div>
        <div className={s.dateItem}>
          <PulseSVG className={s.pulseIcon} />
          <TimeAgo datetime={activeAt} locale="zh_CN" />
        </div>
      </div>
    </Cell>
  )
}

export const TimestampCell = ({ rowData, ...props }) => {
  const s = useSalon()
  const { insertedAt, updatedAt } = rowData

  if (insertedAt === updatedAt) {
    return (
      <Cell {...props}>
        <div className={s.dateCell}>
          <div className={cn(s.dateItem, s.dateItemWarn)}>
            <TimeAgo datetime={insertedAt} locale="zh_CN" />
          </div>
        </div>
      </Cell>
    )
  }

  return (
    <Cell {...props}>
      <div className={s.dateCell}>
        <div className={s.dateItem}>
          {/* <PublishIcon /> */}
          <TimeAgo datetime={insertedAt} locale="zh_CN" />
        </div>
        <div className={s.dateItem}>
          <PulseSVG className={s.pulseIcon} />
          <TimeAgo datetime={updatedAt} locale="zh_CN" />
        </div>
      </div>
    </Cell>
  )
}
