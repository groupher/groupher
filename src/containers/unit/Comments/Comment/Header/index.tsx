import { type FC, memo } from 'react'

import type { TComment } from '~/spec'

import ArticleHeader from './Article'

import type { TAPIMode } from '../../spec'
import { API_MODE } from '../../constant'

import useSalon from '../../styles/comment/header'

type TProps = {
  data: TComment
  apiMode?: TAPIMode
  showInnerRef: boolean
  isReply?: boolean
}

const CommentHeader: FC<TProps> = ({ data, showInnerRef, apiMode = API_MODE.ARTICLE, isReply }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ArticleHeader data={data} showInnerRef={showInnerRef} isReply={isReply} />
    </div>
  )
}

export default memo(CommentHeader)
