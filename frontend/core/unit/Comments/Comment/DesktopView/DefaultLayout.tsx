import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
// import Tooltip from '~/ui/Tooltip'
import PinSVG from '~/icons/Pin'
import ArtimentBody from '~/render/ArtimentBody'
import type { TComment } from '~/spec'

import type { TAPIMode } from '../../spec'
import useActions from '../../useLogic/useActions'
import Footer from '../Footer'
import Header from '../Header'
import ReplyBar from '../ReplyBar'
import useSalon, { cn } from '../salon/desktop_view'

type TProps = {
  data: TComment
  apiMode: TAPIMode
  preview?: boolean
  isReply?: boolean
  showInnerRef?: boolean
}

const DefaultLayout: FC<TProps> = ({
  data,
  isReply = false,
  showInnerRef = false,
  apiMode,
  preview = false,
}) => {
  const s = useSalon()
  const { foldComment } = useActions()
  const { t } = useTrans()

  const { isPinned } = data

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
            <button
              type='button'
              className={s.indentLine}
              aria-label={t('comment.collapse_replies')}
              onClick={() => foldComment(data.innerId)}
            />
          )}
        </div>

        <div className={s.commentBody}>
          <Header data={data} showInnerRef={showInnerRef} apiMode={apiMode} isReply={isReply} />
          <div className={cn(isReply && 'ml-10')}>
            {!isReply && data.replyToComment && <ReplyBar data={data.replyToComment} />}
            <ArtimentBody
              document={{ html: data.body?.html }}
              initLineClamp={preview ? 2 : 6}
              mode='comment'
            />
            <Footer data={data} apiMode={apiMode} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DefaultLayout
