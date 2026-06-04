import type { TFeedbackBucket } from './spec'

export const DEFAULT_FEEDBACK_VALUE = 72

export const DEFAULT_DISTRIBUTION: TFeedbackBucket[] = [
  { id: 'very-unhappy', score: 12, count: 3 },
  { id: 'unhappy', score: 36, count: 7 },
  { id: 'neutral', score: 48, count: 6 },
  { id: 'satisfied', score: 62, count: 4 },
  { id: 'very-satisfied', score: 86, count: 2 },
  { id: 'selection', score: 98, count: 1 },
]
