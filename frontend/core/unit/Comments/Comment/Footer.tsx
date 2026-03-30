import type { FC } from 'react'
import { UPVOTE_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/CheckBold'
import UserBadge from '~/icons/UserBadge'
import { authWarn } from '~/signal'
import type { TComment } from '~/spec'
import useAccount from '~/stores/account/hooks'
import EmotionSelector from '~/unit/EmotionSelector'
import Upvote from '~/unit/Upvote'
import { API_MODE } from '../constant'
import useSalon from '../salon/comment/footer'
import type { TAPIMode } from '../spec'

import useActions from '../useLogic/useActions'
import Actions from './Actions'

type TProps = {
  data: TComment
  apiMode: TAPIMode
}

const Footer: FC<TProps> = ({ data, apiMode }) => {
  const s = useSalon()

  const accountInfo = useAccount()
  const { handleUpvote, handleEmotion } = useActions()
  const { t } = useTrans()

  // const { isLegal } = data.meta
  const { meta, upvotesCount, viewerHasUpvoted } = data
  const { isArticleAuthorUpvoted, isLegal } = meta

  const isSolution = false
  const noExtraInfo = !isSolution && !isArticleAuthorUpvoted

  return (
    <div className={s.wrapper}>
      {!noExtraInfo && (
        <div className={s.extra}>
          {isSolution && (
            <span className={s.anwser}>
              <CheckSVG className={s.checkIcon} />
              {t('comment.footer.solution')}
            </span>
          )}

          {isArticleAuthorUpvoted && (
            <div className={s.authorUpvote}>
              <UserBadge className={s.upvoteIcon} />
              {t('comment.footer.author_upvoted')}
            </div>
          )}
          <div className='grow' />
        </div>
      )}

      <div className={s.main}>
        <Upvote
          left={1.5}
          type={UPVOTE_LAYOUT.COMMENT}
          count={upvotesCount}
          viewerHasUpvoted={viewerHasUpvoted}
          onAction={(did) => handleUpvote(data, did)}
        />

        <div className='mr-2.5' />

        <EmotionSelector
          isLegal={isLegal}
          emotions={data.emotions}
          onAction={(name, hasReacted) => {
            if (!accountInfo) return authWarn()
            handleEmotion(data, name, hasReacted)
          }}
        />

        <div className='mr-2.5' />

        {apiMode === API_MODE.ARTICLE && <Actions data={data} />}

        <div className='grow' />
      </div>
    </div>
  )
}

export default Footer
