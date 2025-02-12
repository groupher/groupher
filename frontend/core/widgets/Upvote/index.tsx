/*
 *
 * Upvote
 *
 */

import { type FC, memo } from 'react'

import type { TUser, TUpvoteLayout, TSpace } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import DefaultLayout from './DefaultLayout'
import ArticleLayout from './ArticleLayout'
import GeneralLayout from './GeneralLayout'
import FixedHeaderLayout from './FixedHeaderLayout'
import CommentLayout from './CommentLayout'
import PostMinimalLayout from './PostMinimalLayout'
import PostListLayout from './PostListLayout'
import StickerLayout from './StickerLayout'
import SimpleLayout from './SimpleLayout'

import useSalon from './salon'

type TProps = {
  testid?: string
  type?: TUpvoteLayout
  count?: number
  avatarsRowLimit?: number
  viewerHasUpvoted?: boolean
  alias?: string // 觉得很赞(default), 觉得很酷(works), 学到了(blog), 感兴趣(meetup), 有意思(Radar)
  avatarList?: TUser[]
  onAction?: (did: boolean) => void
} & TSpace

const Upvote: FC<TProps> = ({
  type = UPVOTE_LAYOUT.DEFAULT,
  left = 0,
  right = 0,
  top = 0,
  bottom = 0,
  ...restProps
}) => {
  const spacing = { left, right, top, bottom }

  const s = useSalon(spacing)

  let Layout = null

  switch (type) {
    case UPVOTE_LAYOUT.COMMENT: {
      Layout = CommentLayout
      break
    }
    case UPVOTE_LAYOUT.POST_MINIMAL: {
      Layout = PostMinimalLayout
      break
    }
    case UPVOTE_LAYOUT.POST_LIST: {
      Layout = PostListLayout
      break
    }
    case UPVOTE_LAYOUT.ARTICLE: {
      Layout = ArticleLayout
      break
    }
    case UPVOTE_LAYOUT.DEFAULT: {
      Layout = DefaultLayout
      break
    }
    case UPVOTE_LAYOUT.FIXED_HEADER: {
      Layout = FixedHeaderLayout
      break
    }
    case UPVOTE_LAYOUT.STICKER: {
      Layout = StickerLayout
      break
    }
    case UPVOTE_LAYOUT.SIMPLE: {
      Layout = SimpleLayout
      break
    }
    default: {
      Layout = GeneralLayout
      break
    }
  }

  return (
    <div className={s.wrapper}>
      <Layout {...restProps} />
    </div>
  )
}

export default memo(Upvote)
