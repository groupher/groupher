import { type FC, Fragment } from 'react'

import type { TComment } from '~/spec'

// import Tooltip from '~/widgets/Tooltip'
import PinSVG from '~/icons/Pin'
import ArtimentBody from '~/widgets/ArtimentBody'

import Header from '../Header'
import ReplyBar from '../ReplyBar'
import Footer from '../Footer'
import IllegalBar from './IllegalBar'

import type { TAPIMode } from '../../spec'

import useLogic from '../../useLogic'
import useSalon, { cn, IndentLine } from '../../styles/comment/desktop_view'

type TProps = {
  data: TComment
  apiMode: TAPIMode
  isReply?: boolean
  showInnerRef?: boolean
}

const DefaultLayout: FC<TProps> = ({ data, isReply = false, showInnerRef = false, apiMode }) => {
  const s = useSalon()
  const { foldComment } = useLogic()

  const { isPinned, meta } = data
  const { isLegal, illegalReason, illegalWords } = meta

  return (
    <div className={cn(s.wrapper, isPinned && 'pt-6')}>
      {isPinned && (
        <div className={s.pinState}>
          <PinSVG className={s.pinIcon} />
          <div className={s.pinText}>置顶讨论</div>
        </div>
      )}
      <div className={s.comment}>
        <div className={s.sidebar}>
          {isReply && <IndentLine onClick={() => foldComment(data.id)} />}
        </div>

        <div className={s.commentBody}>
          <Header data={data} showInnerRef={showInnerRef} apiMode={apiMode} isReply={isReply} />
          <div>
            {isLegal ? (
              <Fragment>
                {!isReply && data.replyTo && <ReplyBar data={data.replyTo} />}
                <ArtimentBody
                  document={{ bodyHtml: data.bodyHtml }}
                  initLineClamp={6}
                  mode="comment"
                />
              </Fragment>
            ) : (
              <IllegalBar illegalReason={illegalReason} illegalWords={illegalWords} />
            )}
          </div>
          <Footer data={data} apiMode={apiMode} />
        </div>
      </div>
    </div>
  )
}

export default DefaultLayout
