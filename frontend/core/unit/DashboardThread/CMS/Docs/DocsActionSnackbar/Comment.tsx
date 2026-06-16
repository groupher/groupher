import type { FC } from 'react'

import ChatCircleTextSVG from '~/icons/ChatCircleText'

import { DOC_ACTION } from './constant'
import useSalon from './salon/comment'

const Comment: FC = () => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={s.button}
      aria-label={DOC_ACTION.COMMENT}
      title={DOC_ACTION.COMMENT}
    >
      <ChatCircleTextSVG className={s.icon} />
    </button>
  )
}

export default Comment
