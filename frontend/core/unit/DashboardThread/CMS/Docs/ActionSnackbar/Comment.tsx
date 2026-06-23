import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ChatCircleTextSVG from '~/icons/ChatCircleText'

import { DOC_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/comment'

const Comment: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const label = t(DOC_ACTION_LABEL_KEY.COMMENT)

  return (
    <button type='button' className={s.button} aria-label={label} title={label}>
      <ChatCircleTextSVG className={s.icon} />
    </button>
  )
}

export default Comment
