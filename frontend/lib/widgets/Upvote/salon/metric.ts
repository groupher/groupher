import type { TUpvoteLayout } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

export const getIconSize = (type: TUpvoteLayout): string => {
  switch (type) {
    case UPVOTE_LAYOUT.ARTICLE: {
      return '30px'
    }

    case UPVOTE_LAYOUT.COMMENT: {
      return '15px'
    }

    default: {
      return '16px'
    }
  }
}

export const holder = 1
