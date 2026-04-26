import { type FC, Fragment } from 'react'

import useTrans from '~/hooks/useTrans'
// import Tooltip from '~/widgets/Tooltip'
import PinSVG from '~/icons/Pin'
import type { TComment } from '~/spec'
import ArtimentBody from '~/widgets/ArtimentBody'

import useSalon, { cn } from '../../salon/comment/desktop_view'
import type { TAPIMode } from '../../spec'
import useActions from '../../useLogic/useActions'
import Footer from '../Footer'
import Header from '../Header'
import ReplyBar from '../ReplyBar'
import IllegalBar from './IllegalBar'

type TProps = {
  data: TComment
  apiMode: TAPIMode
  isReply?: boolean
  showInnerRef?: boolean
}

const DefaultLayout: FC<TProps> = ({ data, isReply = false, showInnerRef = false, apiMode }) => {
  const s = useSalon()
  const { foldComment } = useActions()
  const { t } = useTrans()

  const { isPinned, meta } = data
  const { isLegal, illegalReason, illegalWords } = meta

  return (
    <div className={cn(s.wrapper, isPinned && 'pt-6')}>
      {isPinned && (
        <div className={s.pinState}>
          <PinSVG className={s.pinIcon} />
          <div className={s.pinText}>{t('comment.pin.label')}</div>
        </div>
      )}

      <div className={s.comment}>
        <div className={s.sidebar}>
          {isReply && (
            <button type='button' className={s.indentLine} onClick={() => foldComment(data.id)} />
          )}
        </div>

        <div className={s.commentBody}>
          <Header data={data} showInnerRef={showInnerRef} apiMode={apiMode} isReply={isReply} />
          <div className={cn(isReply && 'ml-10')}>
            {isLegal ? (
              <Fragment>
                {!isReply && data.replyTo && <ReplyBar data={data.replyTo} />}
                <ArtimentBody
                  document={{ bodyHtml: data.bodyHtml }}
                  initLineClamp={6}
                  mode='comment'
                />
              </Fragment>
            ) : (
              <IllegalBar illegalReason={illegalReason} illegalWords={illegalWords} />
            )}
            <Footer data={data} apiMode={apiMode} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DefaultLayout
