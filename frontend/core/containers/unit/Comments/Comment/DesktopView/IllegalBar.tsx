/* eslint-disable react/no-array-index-key */
import { type FC, memo, Fragment } from 'react'

import BotSVG from '~/icons/Bot'
import useTrans from '~/hooks/useTrans'

import useSalon, { cn } from '../../salon/comment/desktop_view/illegal_bar'

type TProps = {
  illegalReason: string[]
  illegalWords: string[]
  isFold?: boolean
}

const IllegalBar: FC<TProps> = ({ illegalReason, illegalWords, isFold }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={cn(s.wrapper, isFold && s.wrapperFold)}>
      <BotSVG className={s.botIcon} />
      <div className={s.content}>
        {t('comment.illegal.prefix')} [
        {illegalReason.map((reason, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <Fragment key={index}>
            <div className={s.reason}>{reason}</div>
            {index !== illegalReason.length - 1 && <>{t('comment.illegal.separator')}</>}
          </Fragment>
        ))}
        ] {t('comment.illegal.suffix')}
      </div>
    </div>
  )
}

export default memo(IllegalBar)
