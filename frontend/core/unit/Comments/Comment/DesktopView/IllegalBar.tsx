import { type FC, Fragment, memo } from 'react'

import useTrans from '~/hooks/useTrans'
import BotSVG from '~/icons/Bot'

import useSalon, { cn } from '../salon/desktop_view/illegal_bar'

type TProps = {
  illegalReason: string[]
  illegalWords: string[]
  isFold?: boolean
}

const IllegalBar: FC<TProps> = ({ illegalReason, illegalWords: _illegalWords, isFold }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={cn(s.wrapper, isFold && s.wrapperFold)}>
      <BotSVG className={s.botIcon} />
      <div className={s.content}>
        {t('comment.illegal.prefix')} [
        {illegalReason.map((reason, index) => (
          <Fragment key={reason}>
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
