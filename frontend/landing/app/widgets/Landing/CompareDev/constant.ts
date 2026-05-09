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

  [ARTICLE_CAT.IDEA]: {
    title: t('landing.compare.metric.idea.title'),
    upvoteText: t('landing.compare.metric.idea.upvote'),
    upvoteNum: 13,
    delay: 5000,
  },

  [ARTICLE_CAT.DISCUSSION]: {
    title: t('landing.compare.metric.discussion.title'),
    upvoteText: t('landing.compare.metric.discussion.upvote'),
    upvoteNum: 18,
    delay: 7000,
  },

  [ARTICLE_CAT.BUG]: {
    title: t('landing.compare.metric.bug.title'),
    upvoteText: t('landing.compare.metric.bug.upvote'),
    upvoteNum: 9,
    delay: 8000,
  },

  [ARTICLE_CAT.QA]: {
    title: t('landing.compare.metric.qa.title'),
    upvoteText: t('landing.compare.metric.qa.upvote'),
    upvoteNum: 6,
    delay: 10000,
  },
})

export const holder = 1
