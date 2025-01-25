import type { FC } from 'react'

import useAccount from '~/hooks/useAccount'

import type { TComment } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import { authWarn } from '~/signal'

import CheckSVG from '~/icons/CheckBold'
import UserBadge from '~/icons/UserBadge'

import EmotionSelector from '~/widgets/EmotionSelector'
import Upvote from '~/widgets/Upvote'

import Actions from './Actions'

import type { TAPIMode } from '../spec'
import { API_MODE } from '../constant'

import useLogic from '../useLogic'
import useSalon from '../salon/comment/footer'

type TProps = {
  data: TComment
  apiMode: TAPIMode
}

const Footer: FC<TProps> = ({ data, apiMode }) => {
  const s = useSalon()

  const accountInfo = useAccount()
  const { handleUpvote, handleEmotion } = useLogic()

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
              解决方案
            </span>
          )}

          {isArticleAuthorUpvoted && (
            <div className={s.authorUpvote}>
              <UserBadge className={s.upvoteIcon} />
              作者点了赞
            </div>
          )}
          <div className="grow" />
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

        <div className="mr-2.5" />

        <EmotionSelector
          isLegal={isLegal}
          emotions={data.emotions}
          onAction={(name, hasEmotioned) => {
            if (!accountInfo) return authWarn()
            handleEmotion(data, name, hasEmotioned)
          }}
        />

        <div className="mr-2.5" />

        {apiMode === API_MODE.ARTICLE && <Actions data={data} />}

        <div className="grow" />
      </div>
    </div>
  )
}

export default Footer
