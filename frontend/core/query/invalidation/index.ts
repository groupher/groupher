import * as article from './article'
import * as comment from './comment'
import * as community from './community'
import {
  invalidate,
  invalidateExact,
  invalidateMatching,
  invalidatePrefix,
  markStale,
  markStalePrefix,
} from './executor'
import * as press from './press'
import * as viewer from './viewer'

export {
  invalidate,
  invalidateExact,
  invalidateMatching,
  invalidatePrefix,
  markStale,
  markStalePrefix,
}
export * from './types'

export const QueryInvalidation = {
  article,
  comment,
  community,
  press,
  viewer,
} as const
