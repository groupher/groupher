import { type FC, memo } from 'react'

import SIZE from '~/const/size'
import CommentSVG from '~/icons/Comment'
import type { TSizeSM, TSpace } from '~/spec'

import useSalon, { cn } from './salon'

type TProps = {
  count: number
  size?: TSizeSM
} & TSpace

const CommentsCount: FC<TProps> = ({ count, size = SIZE.SMALL, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return count >= 100 ? (
    <div className={cn(s.wrapper, s.highlightWrapper)}>
      <CommentSVG className={cn(s.icon, s.iconHighlight)} />
      {size === SIZE.MEDIUM && <div className='mr-0.5' />}
      <div className={s.count}>{count}</div>
    </div>
  ) : (
    <div className={s.wrapper}>
      <CommentSVG className={s.icon} />
      {size === SIZE.MEDIUM && <div className='mr-0.5' />}
      <div className={s.count}>{count}</div>
    </div>
  )
}

export default memo(CommentsCount)
