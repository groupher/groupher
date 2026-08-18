import { find, values } from 'ramda'

import EMOTION from '~/const/emotion'
import type { TEmotion, TEmotionType } from '~/spec'

/** Returns emotion name for the frontend shared workflow. */
export const getEmotionName = (item: TEmotion): TEmotionType => {
  return (item.type || '').toLowerCase() as TEmotionType
}

/** Runs the visible emotions operation at the frontend shared boundary. */
export const visibleEmotions = (emotions: TEmotion[] = []): TEmotion[] => {
  return emotions.filter((emotion) => (emotion.count || 0) > 0)
}

/** Reports whether viewer reacted at the frontend shared boundary. */
export const isViewerReacted = (emotions: TEmotion[], name: TEmotionType): boolean => {
  const emotion = find((item) => getEmotionName(item) === name, emotions)
  return Boolean(emotion?.viewerHasReacted)
}

/** Runs the ensure emotion operation at the frontend shared boundary. */
export const ensureEmotion = (emotions: TEmotion[] = []): TEmotion[] => {
  const known = new Set(emotions.map((emotion) => getEmotionName(emotion)))

  const missing = values(EMOTION)
    .filter((emotion) => !known.has(emotion))
    .map((emotion) => ({
      type: emotion.toUpperCase() as TEmotion['type'],
      count: 0,
      viewerHasReacted: false,
      latestUsers: [],
    }))

  return [...emotions, ...missing]
}
