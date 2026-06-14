import { FEEDBACK_TAG_GROUPS } from './constant'

export const toggleFeedbackTag = (selected: readonly string[], tag: string): string[] => {
  if (selected.includes(tag)) return selected.filter((item) => item !== tag)

  return [...selected, tag]
}

export const getFeedbackTagsByScore = (score: number): readonly string[] => {
  return (
    FEEDBACK_TAG_GROUPS.find(({ min, max }) => score >= min && score <= max)?.labels ??
    FEEDBACK_TAG_GROUPS[0].labels
  )
}
