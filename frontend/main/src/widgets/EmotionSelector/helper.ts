import { includes, reject, keys, values, forEach } from 'ramda'

import EMOTION from '~/const/emotion'
import type { TEmotion, TEmotionType } from '~/spec'
import { titleCase } from '~/fmt'

export const getEmotionName = (item: TEmotion): TEmotionType => {
  const eCountKey = keys(item)[0] as string
  return eCountKey.split('Count')[0] as TEmotionType
}

export const emotionsCoverter = (selectedEmotions: TEmotion): TEmotion[] => {
  const converted = []
  forEach(
    (emotion) =>
      converted.push({
        [`${emotion}Count`]: selectedEmotions[`${emotion}Count`],
        [`latest${titleCase(emotion)}Users`]: selectedEmotions[`latest${titleCase(emotion)}Users`],
        [`viewerHas${titleCase(emotion)}ed`]: selectedEmotions[`viewerHas${titleCase(emotion)}ed`],
      }),
    values(EMOTION),
  )

  // @ts-ignore
  return reject((e) => includes(0, values(e)), converted)
}

export const isViewerEmotioned = (emotions: TEmotion[], name: TEmotionType): boolean => {
  for (let i = 0; i < emotions.length; i += 1) {
    const emotionUnit = emotions[i]

    if (emotionUnit[`viewerHas${titleCase(name)}ed`]) {
      return true
    }
  }

  return false
}
