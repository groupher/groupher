/* eslint-disable react/no-array-index-key */
import { type FC, memo, Fragment } from 'react'

import BotSVG from '~/icons/Bot'

import useSalon, { cn } from '../../styles/comment/desktop_view/illegal_bar'

type TProps = {
  illegalReason: string[]
  illegalWords: string[]
  isFold?: boolean
}

const IllegalBar: FC<TProps> = ({ illegalReason, illegalWords, isFold }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, isFold && s.wrapperFold)}>
      <BotSVG className={s.botIcon} />
      <div className={s.content}>
        该评论包含 [
        {illegalReason.map((reason, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <Fragment key={index}>
            <div className={s.reason}>{reason}</div>
            {index !== illegalReason.length - 1 && <>，</>}
          </Fragment>
        ))}
        ] 内容，不便展示。
      </div>
    </div>
  )
}

export default memo(IllegalBar)
