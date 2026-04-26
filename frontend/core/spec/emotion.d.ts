import type EMOTION from '~/const/emotion'
import type { TConstValues } from '~/spec'

import type { TSimpleUser } from './account'

export type TEmotionType = TConstValues<typeof EMOTION>
export type TEmotionRawType = Uppercase<TEmotionType> | 'UPVOTE'

export type TEmotion = {
  type?: TEmotionRawType
  count?: number
  viewerHasReacted?: boolean
  latestUsers?: TSimpleUser[]
}
