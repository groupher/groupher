/*
 *
 * NoticeBar
 *
 */

import type { FC } from 'react'
import Link from 'next/link'
import TimeAgo from '~/widgets/TimeAgo'

import type { TSpace } from '~/spec'

import QuestionSVG from '~/icons/Question'
import Icon from './Icon'

import type { TType } from './spec'
import { TYPE } from './constant'
import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  type?: TType
  user?: {
    nickname: string
  } | null
  isArticleAuthor?: boolean
  content: string
  timestamp?: string | null
  explainLink?: string | null
  noBg?: boolean
} & TSpace

const NoticeBar: FC<TProps> = ({
  testid = 'notice-bar',
  type = TYPE.NOTICE,
  user = null,
  isArticleAuthor = false,
  content,
  timestamp = null,
  explainLink = null,
  noBg = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={cn(s.wrapper, noBg && s.noBg)}>
      <Icon type={type} />
      <div className={s.main}>
        {user && <div className={s.userName}>{user.nickname}</div>}
        {isArticleAuthor && <div className={s.authorTag}>(作者)</div>}
        {content}
      </div>
      {timestamp && (
        <div className={s.timestamp}>
          <TimeAgo datetime={timestamp} locale="zh_CN" />
        </div>
      )}
      {explainLink && (
        <Link href={explainLink} prefetch={false}>
          <QuestionSVG className={s.questionIcon} />
        </Link>
      )}
    </div>
  )
}

export default NoticeBar
