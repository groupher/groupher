import { FEEDBACK_TAG_GROUPS } from './constant'

/**
 * Toggle one feedback tag in the current selected tag list.
 *
 * @example
 * toggleFeedbackTag(['unclear'], 'typo')
 * // => ['unclear', 'typo']
 */
export const toggleFeedbackTag = (selected: readonly string[], tag: string): string[] => {
  if (selected.includes(tag)) return selected.filter((item) => item !== tag)

  return [...selected, tag]
}

/**
 * Resolve the feedback tag suggestions for a selected rating score.
 *
 * @example
 * getFeedbackTagsByScore(3)
 * // => ['unclear', ...]
 */
export const getFeedbackTagsByScore = (score: number): readonly string[] => {
  return (
    FEEDBACK_TAG_GROUPS.find(({ min, max }) => score >= min && score <= max)?.labels ??
    FEEDBACK_TAG_GROUPS[0].labels
  )
}
