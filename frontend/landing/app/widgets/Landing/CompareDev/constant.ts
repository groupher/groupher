import { ARTICLE_CAT } from '~/const/gtd'
import type { TTransKey } from '~/spec'

type TTranslate = (key: TTransKey) => string

export const getMetricMap = (t: TTranslate) => ({
  DEFAULT: {
    title: t('landing.compare.metric.default.title'),
    upvoteText: t('landing.compare.metric.default.upvote'),
    upvoteNum: 2,
    delay: 6000,
  },

  [ARTICLE_CAT.FEATURE]: {
    title: t('landing.compare.metric.feature.title'),
    upvoteText: t('landing.compare.metric.feature.upvote'),
    upvoteNum: 13,
    delay: 5000,
  },

  [ARTICLE_CAT.OTHER]: {
    title: t('landing.compare.metric.other.title'),
    upvoteText: t('landing.compare.metric.other.upvote'),
    upvoteNum: 18,
    delay: 7000,
  },

  [ARTICLE_CAT.BUG]: {
    title: t('landing.compare.metric.bug.title'),
    upvoteText: t('landing.compare.metric.bug.upvote'),
    upvoteNum: 9,
    delay: 8000,
  },

  [ARTICLE_CAT.QUESTION]: {
    title: t('landing.compare.metric.question.title'),
    upvoteText: t('landing.compare.metric.question.upvote'),
    upvoteNum: 6,
    delay: 10000,
  },
})

export const holder = 1
