import type { TMetric } from '~/spec'
// NOTE:  the value is mapping to @/utils/media's key
// so do not change to lowercase etc...
export default {
  HOME: 'HOME',
  COMMUNITY: 'COMMUNITY',
  COMMUNITY_SIDEBAR: 'COMMUNITY_SIDEBAR',
  DOC: 'DOC',
  USER: 'USER',
  // article
  ARTICLE: 'ARTICLE',
  CHANGELOG_ARTICLE: 'CHANGELOG_ARTICLE',
  DASHBOARD: 'DASHBOARD',
  APPLY_COMMUNITY: 'APPLY_COMMUNITY',

  // 版块
  HELP_CENTER: 'HELP_CENTER',

  // editors
  COMMUNITY_EDITOR: 'COMMUNITY_EDITOR',
  ARTICLE_EDITOR: 'ARTICLE_EDITOR',
} as Record<Uppercase<TMetric>, Uppercase<TMetric>>
