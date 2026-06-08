import { type FC, memo } from 'react'

import type { TComment } from '~/spec'

import { API_MODE } from '../../constant'
import type { TAPIMode } from '../../spec'
import useSalon from '../salon/header'
import ArticleHeader from './Article'

type TProps = {
  data: TComment
  apiMode?: TAPIMode
  showInnerRef: boolean
  isReply?: boolean
}

const CommentHeader: FC<TProps> = ({
  data,
  showInnerRef,
  apiMode: _apiMode = API_MODE.ARTICLE,
  isReply,
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ArticleHeader data={data} showInnerRef={showInnerRef} isReply={isReply} />
    </div>
  )
}

export default memo(CommentHeader)
