import type { EmotionType } from '~/lib/graphql/generated/graphql'

import type { TSimpleUser } from './account'

export type TEmotionType = Exclude<EmotionType, 'UPVOTE'>
export type TEmotionRawType = EmotionType

export type TEmotion = {
  type?: TEmotionRawType
  count?: number
  viewerHasReacted?: boolean
  latestUsers?: TSimpleUser[]
}
