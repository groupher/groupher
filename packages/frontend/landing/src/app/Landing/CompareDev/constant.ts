import { ARTICLE_CAT } from '~/const/gtd'

export const METRIC = {
  DEFAULT: {
    title: '日常迭代',
    upvoteText: 'Sprint',
    upvoteNum: 2,
    delay: 6000,
  },

  [ARTICLE_CAT.FEATURE]: {
    title: '功能请求',
    upvoteText: '同求',
    upvoteNum: 13,
    delay: 5000,
  },

  [ARTICLE_CAT.OTHER]: {
    title: '讨论',
    upvoteText: '赞同',
    upvoteNum: 18,
    delay: 7000,
  },

  [ARTICLE_CAT.BUG]: {
    title: 'Bug',
    upvoteText: '复现',
    upvoteNum: 9,
    delay: 8000,
  },

  [ARTICLE_CAT.QUESTION]: {
    title: '求助',
    upvoteText: '帮顶',
    upvoteNum: 6,
    delay: 10000,
  },
}

export const holder = 1
