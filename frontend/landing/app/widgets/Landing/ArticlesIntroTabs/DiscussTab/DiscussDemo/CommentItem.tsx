import type { FC } from 'react'

import Img from '~/Img'
import type { TUser } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'
import { cnMerge } from '~/css'

import useSalon, {
  cn,
} from '../../../salon/articles_intro_tabs/discuss_tab/discuss_demo/comment_item'

type TProps = {
  user?: TUser
  opacity?: number
  className?: string
}

const CommentItem: FC<TProps> = ({ user, className = '' }) => {
  const s = useSalon()

  return (
    <div className={cnMerge(s.wrapper, className)}>
      <Img src={user.avatar} className={s.avatar} fallback={<ImgFallback user={user} />} />
      <div className={s.rightPart}>
        <div className={s.nickname}>{user.nickname}</div>
        <div className={s.bar} />
        <div className={cn(s.bar, 'w-28')} />
      </div>
    </div>
  )
}

export default CommentItem
